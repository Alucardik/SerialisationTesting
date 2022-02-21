const perfHooks = require('perf_hooks');
const sizeof = require('object-sizeof');

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
    constructor(format, samples = [sampleObj1, sampleObj2], testFilePath = `./test_data/${format.toUpperCase()}`) {
        this._format = format.toUpperCase();
        this._samples = samples;
        switch (this._format) {
            case 'JSON':
                this._stdSerialiser = JSON.stringify;
                this._stdDeserialiser = JSON.parse;
                this._altSerialiser = undefined;
                break;
            case 'YAML':
                this._stdSerialiser = undefined;
                this._altSerialiser = undefined;
                break;
            case 'XML':
                this._stdSerialiser = undefined;
                this._altSerialiser = undefined;
                break;
            case 'PROTO':
                this._stdSerialiser = undefined;
                this._altSerialiser = undefined;
                break;
            case 'AVRO':
                this._stdSerialiser = undefined;
                this._altSerialiser = undefined;
                break;
            case 'MSGPACK':
                this._stdSerialiser = undefined;
                this._altSerialiser = undefined;
                break;
            default:
                throw Error('Provided format is not supported');
        }
    }

    // TODO: learn about enum in js
    // mode: 'serialize' | 'deserialise'
    async _runTest(mode, numberOfRuns) {
        const sampleRuns = {};
        const stats = [];
        if (this._format === 'XML') {
            const err = new Error(`${this._format} is not supported`);
            err.format = this._format;
            throw err;
        }
        this._samples.forEach((sample, ind) => {
            sampleRuns[ind] = (async () => {
                let meanTime = 0;
                for (let i = 0; i < numberOfRuns; ++i) {
                    const startTimestamp = perfHooks.performance.now();
                    mode === 'serialise' ?
                        this._stdSerialiser(sample) :
                        // TODO: load from file?
                        this._stdDeserialiser(this._stdSerialiser(sample));
                    meanTime += perfHooks.performance.now() - startTimestamp;
                }

                return {
                    ind,
                    sampleSize: sizeof(sample),
                    meanCycleTime: meanTime / numberOfRuns,
                };
            })();
        });

        while (Object.keys(sampleRuns).length) {
            try {
                const { ind, ...data } = await Promise.any(Object.values(sampleRuns).values());
                stats.push(data);
                delete sampleRuns[ind];
            } catch (e) {
                throw e;
            }
        }

        return {
            format: this._format,
            stats,
        };
    }

    async serialise(numberOfRuns = 1000) {
        return await this._runTest('serialise', numberOfRuns);
    }

    async deserialise(numberOfRuns = 1000) {
        return this._runTest('deserialise', numberOfRuns);
    }

    getFormat() {
        return this._format;
    }
}

module.exports = Tester;
