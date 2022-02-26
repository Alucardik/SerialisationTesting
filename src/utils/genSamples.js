const { sampleStruct1, sampleStruct2, sampleStruct3 } = require('../constants/sampleStructs');

function getRandomNumber(min, max, intMode = false) {
    if (intMode) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return  Math.floor(Math.random() * (max - min) + min);
    }

    return Math.random() * (max - min) + min;
}

function genArray(length, int) {
    return [...Array(length).keys()].map(() => getRandomNumber(-9223372036, 9223372036, int));
}

function getRandomString(length) {
    return String.fromCharCode(...[...Array(length).keys()].map(() => getRandomNumber(40, 126, true)));
}

function genSamples(sampleStructs) {
    return sampleStructs.map((struct) => {
        const sample = {
            ...struct,
        };

        for (let key in struct) {
            const type = struct[key];
            if (type === 'int') {
                sample[key] = getRandomNumber(-9223372036, 9223372036, true);
            } else if (type === 'float') {
                sample[key] = getRandomNumber(-9223372036, 9223372036);
            } else if (type.startsWith('string')) {
                const [_, strLen] = type.split('@');
                sample[key] = getRandomString(parseInt(strLen));
            } else if (type.startsWith('array')) {
                const [_, subtype, arrLen] = type.split('@');
                sample[key] = genArray(parseInt(arrLen), subtype === 'int');
            } else if (type.startsWith('dict')) {
                const [_, structId] = type.split('@');
                sample[key] = genSamples(eval(`[sampleStruct${structId}]`))[0];
            } else if (type.startsWith('id')) {
                const [_, structId] = type.split('@');
                sample[key] = parseInt(structId);
            } else {
                throw new Error(`Unsupported type ${type}`);
            }
        }

        return sample;
    });
}

module.exports = genSamples;
