import json
import os
import subprocess

data = json.loads(subprocess.check_output(['xcrun','simctl','list','devices','available','--json']))
choices = [(runtime,device) for runtime,devices in data['devices'].items()
           if 'iOS-18' in runtime for device in devices
           if device.get('isAvailable') and device['name'].startswith('iPhone')]
if not choices: raise SystemExit('Xcode 16.4 requires an installed iOS 18 simulator runtime.')
choices.sort(key=lambda entry: ('iOS-18-5' not in entry[0], 'iPhone 16' != entry[1]['name'],entry[1]['name']))
device = choices[0][1]
with open(os.environ['GITHUB_ENV'],'a') as env: env.write('SIMULATOR_UDID='+device['udid']+'\n')
print('Selected',device['name'],choices[0][0])
