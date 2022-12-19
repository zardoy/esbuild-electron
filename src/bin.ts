#!/usr/bin/env node

import { main } from '.'

main({ mode: (process.argv.slice(2).find(x => !x.startsWith('-')) as any) || 'dev', debug: process.argv.includes('--debug') }).catch(error => {
    console.error(error)
    process.exit(1)
})
