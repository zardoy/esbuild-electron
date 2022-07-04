#!/usr/bin/env node

import { main } from '.'

main({ mode: (process.argv[2] as any) || 'dev' }).catch(error => {
    console.error(error)
    process.exit(1)
})
