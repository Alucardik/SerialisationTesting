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
    constructor(format, samples = [sampleObj1, sampleObj2], testFilePath = `./test_data/${format}`) {
        this._format = format;
        switch (this._format) {
            case 'JSON':
                this._stdSerialiser = JSON;
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
        }
    }

    getFormat() {
        return this._format;
    }

    async serialise() {
        const startTimestamp = perfHooks.performance.now();
        console.log('IM ', this._format, 'parser');
        if (this.getFormat() === 'XML') {
            const err = new Error('Some error');
            err.format = this._format;
            throw err;
        }
        // if (parseInt(Math.round(Math.random())) % 2) {
        //     const err = new Error('Some error');
        //     err.format = this._format;
        //     throw err;
        // }
        return {
            format: this._format,
            cycleTime: perfHooks.performance.now() - startTimestamp,
        }
    }

    async deserialise() {
        const startTimestamp = perfHooks.performance.now(); // in ms
        return {
            format: this._format,
            cycleTime: perfHooks.performance.now() - startTimestamp,
        }
    }
}

module.exports = Tester;
