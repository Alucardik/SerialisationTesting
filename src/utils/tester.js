
// -- system imports
const fs = require('fs');
const { Buffer } = require('buffer');
const { performance } = require('perf_hooks');
const sizeof = require('object-sizeof');

// -- parsers
const { Builder: xmlSerialiser, Parser: xmlDeserialiser } = require('xml2js');
const protobuf = require('protobufjs');
const yaml = require('yaml');
const avro = require('avro-js');
// const msgpack = require('msgpack');

// -- constants
const { formatFileMappings } = require('../constants/formatMappings');
const { sampleStructs } = require('../config');

// -- utils
const genSamples = require('./genSamples');

const globalSamples = genSamples(sampleStructs);

class Tester {
    // testDataPath - path for saving serialised files
    constructor(format, testDataPath = `${__dirname}/../../test_data/${format.toUpperCase()}`) {
        this._format = format.toUpperCase();
        this._samples = globalSamples;
        // fs module works with the absolute paths
        this._dataPath = testDataPath.startsWith('/') ? testDataPath : `${__dirname}/${testDataPath}`;
        switch (this._format) {
            case 'JSON':
                this._serialiser = JSON.stringify;
                this._deserialiser = JSON.parse;
                break;
            case 'YAML':
                this._serialiser = yaml.stringify;
                this._deserialiser = yaml.parse;
                break;
            case 'XML':
                const serialiser = new xmlSerialiser();
                this._serialiser = serialiser.buildObject.bind(serialiser);
                this._deserialiser = new xmlDeserialiser().parseString;
                break;
            case 'PROTO':
                // will be filled in the _postInitLoader method
                this._deserialiser = {};
                this._serialiser = {};
                try {
                    this._postInit = protobuf.load(__dirname + '../../../protobufs/sample.proto');
                } catch (e) {
                    throw this._constructError(e);
                }
                break;
            case 'AVRO':
                this._serialiser = {};
                this._deserialiser = {};
                this._postInit = (async () => {
                    for (let i = 0; i < this._samples.length; ++i) {
                        const type = avro.parse(__dirname + `/../../avro/sampleStruct${this._samples[i].structId}.avsc`);
                        if (!type.isValid(this._samples[i])) {
                            throw this._constructError(new Error(`Sample object ${i + 1} doesnt satisfy avro schema`));
                        }
                        this._serialiser[i] = type.toBuffer.bind(type);
                        this._deserialiser[i] = type.fromBuffer.bind(type);
                    }
                })();
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
                        const protoMsg = root.lookupType(`sampleStruct${sample.structId}`);
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
            case 'AVRO':
                try {
                    await this._postInit;
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
            } else if (this._format === 'AVRO') {
                encoding = 'binary';
                buf = this._serialiser[ind](sample);
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
        (this._format === 'PROTO' || this._format === 'AVRO') ?
            encoding = 'binary' :
            encoding = 'utf8';

        for (let i = 0; i < this._samples.length; ++i) {
            sampleRuns[i] = (async () => {
                let meanTime = 0;
                // save file content here in case of deserialisation
                let struct;
                for (let j = 0; j < numberOfRuns; ++j) {
                    let startTimestamp = performance.now();
                    if (mode === 'serialise') {
                        // in protobufs and avro serialisers / deserialisers are created per each struct type
                        switch (this._format) {
                            case 'PROTO':
                                this._serialiser[i](this._samples[i]).finish();
                                break;
                            case 'AVRO':
                                this._serialiser[i](this._samples[i]);
                                break;
                            default:
                                this._serialiser(this._samples[i]);
                        }
                    } else {
                        try {
                            struct = fs.readFileSync(this._getSamplePath(i), { encoding });
                            (this._format === 'PROTO' || this._format === 'AVRO') ?
                                this._deserialiser[i](Buffer.from(struct, encoding)) :
                                this._deserialiser(struct);
                        } catch (e) {
                            throw this._constructError(e);
                        }
                    }
                    meanTime += performance.now() - startTimestamp;
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
