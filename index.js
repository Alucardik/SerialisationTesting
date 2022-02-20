const { formats } = require('./config');
const Tester = require('./tester');

const fs = require('fs');

async function main() {
    const serialisationRuns = {};
    const deserialisationRuns = {};
    const testers = {};


    formats.forEach((format) => {
        testers[format] = new Tester(format);
        serialisationRuns[format] = testers[format].serialise();
    });

    while (Object.keys(serialisationRuns).length) {
        try {
            const { format, cycleTime } = await Promise.any(Object.values(serialisationRuns));
            console.log('cool', cycleTime);
            delete serialisationRuns[format];
            deserialisationRuns[format] = testers[format].deserialise();
        } catch (e) {
            e.errors.forEach(({ format }) => {
                console.log(format, 'fucked up')
                delete serialisationRuns[format];
            });
        }
    }

    while (Object.keys(deserialisationRuns).length) {
        try {
            const { format, cycleTime } = await Promise.any(Object.values(deserialisationRuns));
            console.log('cool', cycleTime);
            delete deserialisationRuns[format];
        } catch (e) {
            e.errors.forEach(({ format }) => {
                console.log(format, 'fucked up')
                delete deserialisationRuns[format];
            });
        }
    }

}

main();
