#!/bin/bash

protoc --js_out=import_style=commonjs,binary:protobufs/models -I ./protobufs sample.proto
