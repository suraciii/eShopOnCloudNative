
import { sleep, check } from 'k6';
import { Options } from 'k6/options';
import http from 'k6/http';

export let options: Options = {
    discardResponseBodies: true,
    scenarios: {
        create_account: {
            executor: 'per-vu-iterations',
            vus: 1000,
            iterations: 1,
            maxDuration: '10m',
        },
    },
};

export default () => {
    const reqBody = {
        "Email": `testuser-${__VU}@test.tt`,
        "Password": "P@ssw0rd!",
        "ConfirmPassword": "P@ssw0rd!",
        "User": {
            "CardNumber": "123123",
            "SecurityNumber": "123",
            "Expiration": "11/23",
            "CardHolderName": "Test User",
            "CardType": 0,
            "Street": "Unknown",
            "City": "Revachol",
            "State": "Revachol",
            "Country": "Revachol",
            "ZipCode": "123123",
            "Name": "Test",
            "LastName": `User${__VU}`,
            "PhoneNumber": "123123"
        }
    };
    const res = http.post(`${__ENV.IDENTITY_URL}/api/v1/accounts`, JSON.stringify(reqBody));
    check(res, {
        'status is 200': () => res.status === 200,
    });
};
