/* @flow */

import { ZalgoPromise } from 'zalgo-promise/src';
import { stringifyError } from 'belter/src';

import { upgradeFacilitatorAccessToken } from '../api';
import { getLogger } from '../lib';
import { upgradeLSATExperiment } from '../experiments';
import { LSAT_UPGRADE_EXCLUDED_MERCHANTS } from '../constants';

import type { CreateOrder } from './createOrder';

export type XOnAuthDataType = {|
    accessToken : ?string
|};

export type OnAuth = (params : XOnAuthDataType) => ZalgoPromise<string | void>;

type GetOnAuthOptions = {|
    facilitatorAccessToken : string,
    createOrder : CreateOrder,
    upgradeLSAT : boolean,
    userIDToken : ?string,
    clientID : string
|};

export function getOnAuth({ facilitatorAccessToken, createOrder, upgradeLSAT, userIDToken, clientID } : GetOnAuthOptions) : OnAuth {
    upgradeLSAT = (upgradeLSAT || Boolean(userIDToken) || upgradeLSATExperiment.isEnabled()) && LSAT_UPGRADE_EXCLUDED_MERCHANTS.indexOf(clientID) === -1;

    return ({ accessToken } : XOnAuthDataType) => {
        getLogger().info(`spb_onauth_access_token_${ accessToken ? 'present' : 'not_present' }`);

        return ZalgoPromise.try(() => {
            if (accessToken) {
                upgradeLSATExperiment.logStart();

                if (upgradeLSAT) {
                    return createOrder()
                        .then(orderID => upgradeFacilitatorAccessToken(facilitatorAccessToken, { buyerAccessToken: accessToken, orderID }))
                        .then(() => {
                            getLogger().info('upgrade_lsat_success');

                            return accessToken;
                        })
                        .catch(err => {
                            getLogger().warn('upgrade_lsat_failure', { error: stringifyError(err) });

                            return accessToken;
                        });
                }
                return accessToken;
            }
        });
    };
}
