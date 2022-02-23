const { formats, numberOfRuns } = require('./config');
const Tester = require('./utils/tester');

async function main() {
    const serialisationRuns = {};
    const deserialisationRuns = {};
    const testers = {};

    formats.forEach((format) => {
        testers[format] = new Tester(format);
        serialisationRuns[format] = testers[format].serialise(numberOfRuns);
    });

    while (Object.keys(serialisationRuns).length) {
        // TODO: maybe move try-catch block to a separate function
        try {
            const { format, stats } = await Promise.any(Object.values(serialisationRuns));
            console.log(`${format} serialiser stats`, stats);
            delete serialisationRuns[format];
            deserialisationRuns[format] = testers[format].deserialise(numberOfRuns);
        } catch (e) {
            const errors = [];
            // we can encounter a single error or an array of errors
            e.errors ? errors.push(...e.errors) : errors.push(e);
            errors.forEach(({ format, message }) => {
                console.log(format, 'serialiser failed');
                console.log('Error', message);
                delete serialisationRuns[format];
            });
        }
    }

    while (Object.keys(deserialisationRuns).length) {
        try {
            const { format, stats } = await Promise.any(Object.values(deserialisationRuns));
            console.log(`${format} deserialiser stats`, stats);
            delete deserialisationRuns[format];
        } catch (e) {
            e.errors.forEach(({ format, message }) => {
                console.log(format, ' deserialiser failed');
                console.log('Error', message);
                delete deserialisationRuns[format];
            });
        }
    }

}

main().then();
