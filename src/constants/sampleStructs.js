const sampleStruct1 = {
    structId: 'id@1',
    integer: 'int',
    float: 'float',
    stringData: 'string@100',
};

const sampleStruct2 = {
    structId: 'id@2',
    ...sampleStruct1,
    extendedStringData: 'string@2500',
    arrayInt: 'array@int@200',
    arrayFloat: 'array@float@200',
};

const sampleStruct3 = {
    structId: 'id@3',
    ...sampleStruct2,
    dict1: 'dict@1',
    dict2: 'dict@2',
};

module.exports = {
    sampleStruct1,
    sampleStruct2,
    sampleStruct3,
};
