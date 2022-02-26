const { sampleStruct1, sampleStruct2, sampleStruct3 } = require('./constants/sampleStructs');

const formats = ['JSON', 'XML', 'PROTO', 'YAML', 'AVRO', 'MSGPACK'];
const sampleStructs = [sampleStruct1, sampleStruct2, sampleStruct3];
const numberOfRuns = 1000;

module.exports = {
    formats,
    numberOfRuns,
    sampleStructs,
};
