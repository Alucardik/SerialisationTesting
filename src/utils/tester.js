// -- system imports
const fs = require('fs');
const { Buffer } = require('buffer');
const perfHooks = require('perf_hooks');
const sizeof = require('object-sizeof');

// -- parsers
const { Builder: xmlSerialiser, Parser: xmlDeserialiser } = require('xml2js');
const protobuf = require('protobufjs');

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
    nested1: {
        ...sampleObj1
    },
};

class Tester {
    // testDataPath - path for saving serialised files
    constructor(format, testDataPath = `${__dirname}/../../test_data/${format.toUpperCase()}`) {
        this._format = format.toUpperCase();
        this._samples = [sampleObj1, sampleObj2];
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
                // fill be filed in the _postInitLoader method
                this._deserialiser = {};
                this._serialiser = {};
                try {
                    // TODO: maybe wrap path into a separate var
                    this._postInit = protobuf.load(__dirname + '../../../protobufs/sample.proto');
                } catch (e) {
                    throw this._constructError(e);
                }
                break;
            case 'AVRO':
                this._serialiser = undefined;
                this._deserialiser = undefined;
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

    // execute some code (mostly asynchronous) after constructor
    // (e.g. some libraries are asynchronous, so they cannot be executed in the constructor)
    async _postInitLoader() {
        switch (this._format) {
            case 'PROTO':
                try {
                    const root = await this._postInit;

                    // we need to convert standard JS objects to protobuf structs
                    this._samples = this._samples.map((sample, ind) => {
                        const protoMsg = root.lookupType(`sampleStruct${ind + 1}`);
                        const e = protoMsg.verify(sample);
                        if (e) {
                            throw this._constructError(e);
                        }
                        this._serialiser[ind] = protoMsg.encode;
                        this._deserialiser[ind] = protoMsg.decode.bind(protoMsg);
                        return protoMsg.create(sample);
                    });
                } catch (e) {
                    throw this._constructError(e);
                }
                break;
            default:
                return;
        }
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

            let buf;
            let encoding;
            if (this._format === 'PROTO') {
                encoding = 'binary';
                buf = this._serialiser[ind](sample).finish();
            } else {
                encoding = 'utf8';
                buf = Buffer.from(this._serialiser(sample), encoding);
            }

            try {
                fs.writeFileSync(this._getSamplePath(ind), buf, encoding);
            } catch (e) {
                throw this._constructError(e);
            }
        });
    }

    // mode: 'serialize' | 'deserialise'
    async _runTest(mode, numberOfRuns) {
        const sampleRuns = {};
        const stats = [];
        let encoding;
        (this._format === 'PROTO') ?
            encoding = 'binary' :
            encoding = 'utf8';

        for (let i = 0; i < this._samples.length; ++i) {
            sampleRuns[i] = (async () => {
                let meanTime = 0;
                // save file content here in case of deserialisation
                let struct;
                for (let j = 0; j < numberOfRuns; ++j) {
                    const startTimestamp = perfHooks.performance.now();
                    if (mode === 'serialise') {
                        // in protobufs serialisers / deserialisers are created per each message type
                        (this._format === 'PROTO') ?
                            this._serialiser[i](this._samples[i]).finish() :
                            this._serialiser(this._samples[i]);
                    } else {
                        try {
                            struct = fs.readFileSync(this._getSamplePath(i), { encoding });
                        } catch (e) {
                            throw this._constructError(e);
                        }
                        (this._format === 'PROTO') ?
                            this._deserialiser[i](Buffer.from(struct, encoding)) :
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
        await this._postInitLoader();
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
