'use strict';

const apiIndex = require('../../api');

let expect;

function makeSettings() {
    return {
        language: 'en',
        secureEnabled: true,
        secretCode: 'jwt-secret',
        smtp: {
            host: 'smtp.internal',
            port: 587,
            username: 'smtp-user',
            password: 'smtp-secret',
            mailsender: 'fuxa@example.com'
        },
        daqstore: {
            type: 'influxDB',
            url: 'http://influx.internal:8086',
            host: 'questdb.internal',
            configurationString: 'http::addr=questdb.internal:9000;username=daq-user;password=daq-secret;',
            database: 'fuxa',
            credentials: {
                username: 'daq-user',
                password: 'daq-secret'
            }
        }
    };
}

describe('Security - settings disclosure', () => {
    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    it('always removes passwords and the JWT secret, preserving daqstore credentials for admins', () => {
        const settings = makeSettings();

        const adminSettings = apiIndex._getSanitizedSettings(settings);
        const publicSettings = apiIndex._getPublicSettings(settings);

        expect(adminSettings).to.not.have.property('secretCode');
        expect(adminSettings.smtp).to.not.have.property('password');
        expect(adminSettings.daqstore).to.have.property('credentials');

        expect(publicSettings).to.not.have.property('secretCode');
        expect(publicSettings.smtp).to.not.have.property('password');
        expect(publicSettings.daqstore).to.not.have.property('credentials');

        expect(settings).to.deep.equal(makeSettings());
    });

    it('removes infrastructure connection details from public settings', () => {
        const publicSettings = apiIndex._getPublicSettings(makeSettings());

        expect(publicSettings.smtp).to.not.have.property('host');
        expect(publicSettings.smtp).to.not.have.property('port');
        expect(publicSettings.smtp).to.not.have.property('username');
        expect(publicSettings.smtp.mailsender).to.equal('fuxa@example.com');
        expect(publicSettings.daqstore).to.not.have.property('url');
        expect(publicSettings.daqstore).to.not.have.property('host');
        expect(publicSettings.daqstore).to.not.have.property('configurationString');
        expect(publicSettings.daqstore).to.include({
            type: 'influxDB',
            database: 'fuxa'
        });
    });

    it('keeps non-secret connection details available to admins', () => {
        const adminSettings = apiIndex._getSanitizedSettings(makeSettings());

        expect(adminSettings.smtp).to.include({
            host: 'smtp.internal',
            port: 587,
            username: 'smtp-user'
        });
        expect(adminSettings.daqstore).to.include({
            url: 'http://influx.internal:8086',
            host: 'questdb.internal',
            configurationString: 'http::addr=questdb.internal:9000;username=daq-user;password=daq-secret;'
        });
    });
});
