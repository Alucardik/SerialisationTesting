const { sampleStruct1, sampleStruct2, sampleStruct3 } = require('./constants/sampleStructs');

const formats = ['JSON', 'XML', 'MSGPACK', 'YAML', 'PROTO', 'AVRO'];
const sampleStructs = [sampleStruct1, sampleStruct2, sampleStruct3];
const numberOfRuns = 1000;

module.exports = {
    formats,
    numberOfRuns,
    sampleStructs,
};
