import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests-web/browser',timeout:45000,expect:{timeout:10000},fullyParallel:false,workers:1,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:4173/Ant-farm-simulation/',trace:'retain-on-failure',screenshot:'only-on-failure',serviceWorkers:'allow'},
  webServer:{command:'node scripts/serve-web.mjs',url:'http://127.0.0.1:4173/Ant-farm-simulation/',reuseExistingServer:!process.env.CI},
  projects:[{name:'chromium',use:{browserName:'chromium',viewport:{width:1280,height:720}}},{name:'webkit',use:{...devices['iPhone 13'],browserName:'webkit',viewport:{width:844,height:390}}}]
});
