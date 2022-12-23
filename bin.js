#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require(".");
(0, _1.main)({ mode: process.argv.slice(2).find(x => !x.startsWith('-')) || 'dev', debug: process.argv.includes('--debug') }).catch(error => {
    console.error(error);
    process.exit(1);
});
