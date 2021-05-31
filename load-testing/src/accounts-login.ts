
import { check } from 'k6';
import { Options } from 'k6/options';
import http from 'k6/http';

export let options: Options = {
    discardResponseBodies: true,
    scenarios: {
        account_getToken: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '5s', target: 100 },
                { duration: '5s', target: 0 },
            ],
            gracefulRampDown: '0s',
        },
    },
};

export default () => {
    const reqBody = {
        "username": `testuser-${__VU}@test.tt`,
        "Password": "P@ssw0rd!",
        "grant_type": "password",
        "scope": "openid profile basket",
        // "client_id": "test",
        // "client_secret": "secret"
    };
    const res = http.post(`${__ENV.IDENTITY_URL}/connect/token`, reqBody, {
        headers: {
            'Authorization': 'Basic dGVzdDpzZWNyZXQ='
        }
    });
    check(res, {
        'status is 200': () => res.status === 200,
    });
};
