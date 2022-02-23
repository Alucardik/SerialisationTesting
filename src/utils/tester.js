// -- system imports
const fs = require('fs');
const { Buffer } = require('buffer');
const perfHooks = require('perf_hooks');
const sizeof = require('object-sizeof');

// -- parsers
const { Builder: xmlSerialiser, Parser: xmlDeserialiser } = require('xml2js');

// -- constants
const { formatFileMappings } = require('./formatMappings');

const ints = [...Array(100).keys()];
const floats = [...Array(100).keys()].map((number) => {
    return number + Math.random();
});

const sampleObj1 = {
    integer:  112,
    float: 112.45,
    stringData: `Lorem ipsum dolor sit amet, consectetur adipiscing
                 elit. Mauris adipiscing adipiscing placerat.
                 Vestibulum augue augue,
                 pellentesque quis sollicitudin id, adipiscing.`,
    array: ints,
};

const sampleObj2 = {
    ...sampleObj1,
    extendedStringData: `Короче, Меченый, я тебя спас и в благородство играть не буду:
                     выполнишь для меня пару заданий – и мы в расчете. Заодно посмотрим, как быстро
                     у тебя башка после амнезии прояснится. А по твоей теме постараюсь разузнать.
                     Хрен его знает, на кой ляд тебе этот Стрелок сдался, но я в чужие дела не лезу,
                     хочешь убить, значит есть за что…`,
    nested: {
        ...sampleObj1
    },
};

class Tester {
    constructor(format, samples = [sampleObj1, sampleObj2], testDataPath = `${__dirname}/../test_data/${format.toUpperCase()}`) {
        this._format = format.toUpperCase();
        this._samples = samples;
        // fs module works with the absolute paths
        this._dataPath = testDataPath.startsWith('/') ? testDataPath : `${__dirname}/${testDataPath}`;
        switch (this._format) {
            case 'JSON':
                this._serialiser = JSON.stringify;
                this._deserialiser = JSON.parse;
                break;
            case 'YAML':
                this._serialiser = undefined;
                this._deserialiser = undefined;
                break;
            case 'XML':
                const serialiser = new xmlSerialiser();
                this._serialiser = serialiser.buildObject.bind(serialiser);
                this._deserialiser = new xmlDeserialiser().parseString;
                break;
            case 'PROTO':
                this._serialiser = undefined;
                this._deserialiser = undefined;
                break;
            case 'AVRO':
                this._serialiser = undefined;
                this._serialiser = undefined;
                break;
            case 'MSGPACK':
                this._serialiser = undefined;
                this._deserialiser = undefined;
                break;
            default:
                throw this._constructError(Error('Provided format is not supported'));
        }
    }

    _constructError(e) {
        // can add extra fields for debugging here
        e.format = this._format;
        return e;
    }

    _getSamplePath(sampleIndex) {
        return `${this._dataPath}/sample${sampleIndex}.${formatFileMappings[this._format]}`;
    }

    // saves serialised structures into files for the further deserialisation
    _updateFiles() {
        this._samples.forEach((sample, ind) => {
            // doing synchronous call to ensure that parent directory for the next call exists
            try {
                fs.mkdirSync(this._dataPath, { recursive: true });
            } catch (e) {
                if (e.code !== 'EEXIST') {
                    throw this._constructError(e);
                }
            }

            try {
                fs.writeFileSync(this._getSamplePath(ind), Buffer.from(this._serialiser(sample), 'utf8'));
            } catch (e) {
                throw this._constructError(e);
            }
        });
    }

    // mode: 'serialize' | 'deserialise'
    async _runTest(mode, numberOfRuns) {
        const sampleRuns = {};
        const stats = [];
        for (let i = 0; i < this._samples.length; ++i) {
            sampleRuns[i] = (async () => {
                let meanTime = 0;
                // save file content here in case of deserialisation
                let struct;
                for (let j = 0; j < numberOfRuns; ++j) {
                    const startTimestamp = perfHooks.performance.now();
                    if (mode === 'serialise') {
                        this._serialiser(this._samples[i]);
                    } else {
                        try {
                            struct = fs.readFileSync(this._getSamplePath(i), { encoding: 'utf8' });
                            // console.log('HEY', struct);
                        } catch (e) {
                            throw this._constructError(e);
                        }
                        this._deserialiser(struct);
                    }
                    meanTime += perfHooks.performance.now() - startTimestamp;
                }

                // TODO: correct stats
                return {
                    index: i,
                    sampleSize: sizeof(this._samples[i]),
                    meanCycleTime: meanTime / numberOfRuns,
                };
            })();
        }

        while (Object.keys(sampleRuns).length) {
            try {
                const { index, ...data } = await Promise.any(Object.values(sampleRuns).values());
                stats.push(data);
                delete sampleRuns[index];
            } catch (e) {
                throw this._constructError(e);
            }
        }

        return {
            format: this._format,
            stats,
        };
    }

    async serialise(numberOfRuns = 100) {
        this._updateFiles();
        return await this._runTest('serialise', numberOfRuns);
    }

    async deserialise(numberOfRuns = 100) {
        return this._runTest('deserialise', numberOfRuns);
    }

    getFormat() {
        return this._format;
    }
}

module.exports = Tester;
