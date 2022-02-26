const { formats, numberOfRuns } = require('./config');
const Tester = require('./utils/tester');

async function main() {
    const serialisationRuns = {};
    const deserialisationRuns = {};
    const testers = {};
    const aggrStats = {};

    formats.forEach((format) => {
        testers[format] = new Tester(format);
        serialisationRuns[format] = testers[format].serialise(numberOfRuns);
        aggrStats[format] = {
            serialisation: {},
            deserialisation: {},
        };
    });

    while (Object.keys(serialisationRuns).length) {
        try {
            const { format, stats } = await Promise.any(Object.values(serialisationRuns));
            aggrStats[format].serialisation = stats;
            console.log(`${format}\tserialiser finished`);
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
            aggrStats[format].deserialisation = stats;
            console.log(`${format}\tdeserialiser finished`);
            delete deserialisationRuns[format];
        } catch (e) {
            const errors = [];
            // we can encounter a single error or an array of errors
            e.errors ? errors.push(...e.errors) : errors.push(e);
            errors.forEach(({ format, message }) => {
                console.log(format, ' deserialiser failed');
                console.log('Error', message);
                delete deserialisationRuns[format];
            });
        }
    }

    for (let format in aggrStats) {
        console.log(`\n--------------  ${format} STATS  --------------\n`);
        for (let i = 0; i < aggrStats[format].serialisation.length; ++i) {
            console.log(`  ## SAMPLE ${i + 1}:\n\n`,
                `  - initial size(bytes):\t${aggrStats[format].serialisation[i].initialSampleSize}\n\n`,
                `  - serialised size(bytes):\t${aggrStats[format].serialisation[i].serialisedSampleSize}\n\n`,
                `  - mean serialisation time(ns):\t${aggrStats[format].serialisation[i].meanCycleTime * 10e6}\n\n`,
                `  - mean deserialisation time(ns):\t${aggrStats[format].deserialisation[i].meanCycleTime * 10e6}\n\n`
            );
        }
    }
}

main().then();
