#!/usr/bin/env python3
"""Generate the dependency-free Xcode project and original app icon."""
import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]

def uid(value):
    return hashlib.sha1(value.encode()).hexdigest()[:24].upper()

def write_icon():
    assets = ROOT / 'AntFarm/Assets.xcassets'
    icons = assets / 'AppIcon.appiconset'
    icons.mkdir(parents=True, exist_ok=True)
    (assets / 'Contents.json').write_text(json.dumps({'info': {'author': 'xcode', 'version': 1}}))
    (icons / 'Contents.json').write_text(json.dumps({'images': [{'filename': 'AppIcon.png', 'idiom': 'universal', 'platform': 'ios', 'size': '1024x1024'}], 'info': {'author': 'xcode', 'version': 1}}, indent=2))
    colors = assets / 'LaunchBackground.colorset'
    colors.mkdir(exist_ok=True)
    (colors / 'Contents.json').write_text(json.dumps({'colors': [{'idiom': 'universal', 'color': {'color-space': 'srgb', 'components': {'red': '0.063', 'green': '0.118', 'blue': '0.110', 'alpha': '1.000'}}}], 'info': {'author': 'xcode', 'version': 1}}, indent=2))
    # Draw at 64px and expand with nearest-neighbor sampling. No third-party image dependency.
    pixels = [[(23,43,36) for _ in range(64)] for _ in range(64)]
    def rect(x,y,w,h,color):
        for py in range(max(0,y), min(64,y+h)):
            for px in range(max(0,x), min(64,x+w)):
                pixels[py][px] = color
    rect(6,6,52,52,(35,60,44)); rect(9,9,46,46,(38,67,48))
    gold, light, dark = (208,160,89),(243,207,136),(121,87,46)
    for x in [27,34,41]:
        rect(x,18,2,9,gold); rect(x-6,16,8,2,gold)
        rect(x,37,2,10,gold); rect(x-5,46,7,2,gold)
    rect(10,27,16,12,dark); rect(12,24,12,18,gold); rect(14,25,8,3,light)
    rect(24,31,6,4,gold); rect(30,27,10,12,gold); rect(32,28,5,2,light)
    rect(39,31,5,4,gold); rect(44,26,11,12,gold); rect(45,27,7,2,light)
    rect(51,28,2,2,(23,43,36)); rect(51,20,2,7,gold); rect(52,18,6,2,gold)
    rect(51,37,2,7,gold); rect(52,43,6,2,gold)
    raw = bytearray()
    for y in range(1024):
        raw.append(0)
        for x in range(1024): raw.extend(pixels[y//16][x//16])
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    png = b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b'')
    (icons/'AppIcon.png').write_bytes(png)

def generate():
    write_icon()
    objects = {}
    def obj(key,body):
        ident = uid(key); objects[ident] = body; return ident
    def quoted(value): return json.dumps(value)
    app_sources = sorted(str(p.relative_to(ROOT)) for folder in ['AntFarm','Sources/AntFarmCore'] for p in (ROOT/folder).glob('*.swift'))
    ui_sources = sorted(str(p.relative_to(ROOT)) for p in (ROOT/'AntFarmUITests').glob('*.swift'))
    resources = ['AntFarm/Assets.xcassets','AntFarm/PrivacyInfo.xcprivacy']
    all_files = app_sources+ui_sources+resources+['AntFarm/Info.plist']
    file_ids = {}
    for path in all_files:
        kind = 'sourcecode.swift' if path.endswith('.swift') else 'folder.assetcatalog' if path.endswith('.xcassets') else 'text.plist.xml'
        file_ids[path] = obj('file:'+path, f'isa = PBXFileReference; lastKnownFileType = {kind}; path = {quoted(path)}; sourceTree = "<group>";')
    def phase(name,isa,paths):
        builds = [obj('build:'+name+':'+p, f'isa = PBXBuildFile; fileRef = {file_ids[p]};') for p in paths]
        return obj(name, f'isa = {isa}; buildActionMask = 2147483647; files = ({",".join(builds)}); runOnlyForDeploymentPostprocessing = 0;')
    app_phase = phase('app-sources','PBXSourcesBuildPhase',app_sources)
    ui_phase = phase('ui-sources','PBXSourcesBuildPhase',ui_sources)
    resource_phase = phase('app-resources','PBXResourcesBuildPhase',resources)
    app_frameworks = phase('app-frameworks','PBXFrameworksBuildPhase',[])
    ui_frameworks = phase('ui-frameworks','PBXFrameworksBuildPhase',[])
    app_product = obj('app-product','isa = PBXFileReference; explicitFileType = wrapper.application; path = AntFarm.app; sourceTree = BUILT_PRODUCTS_DIR;')
    ui_product = obj('ui-product','isa = PBXFileReference; explicitFileType = wrapper.cfbundle; path = AntFarmUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR;')
    products = obj('products',f'isa = PBXGroup; children = ({app_product},{ui_product}); name = Products; sourceTree = "<group>";')
    group = obj('main-group',f'isa = PBXGroup; children = ({",".join(file_ids.values())},{products}); sourceTree = "<group>";')
    def config_list(name,kind):
        ids = []
        for mode in ['Debug','Release']:
            settings = {'SWIFT_VERSION':'5.0','IPHONEOS_DEPLOYMENT_TARGET':'17.0','CLANG_ENABLE_MODULES':'YES','SDKROOT':'iphoneos','SUPPORTED_PLATFORMS':'iphoneos iphonesimulator','TARGETED_DEVICE_FAMILY':'1','ENABLE_USER_SCRIPT_SANDBOXING':'YES','SWIFT_OPTIMIZATION_LEVEL':'-Onone' if mode == 'Debug' else '-O','DEBUG_INFORMATION_FORMAT':'dwarf' if mode == 'Debug' else 'dwarf-with-dsym','SWIFT_ACTIVE_COMPILATION_CONDITIONS':'DEBUG' if mode == 'Debug' else ''}
            if kind == 'app': settings.update({'PRODUCT_NAME':'AntFarm','PRODUCT_BUNDLE_IDENTIFIER':'com.owningturtle.antfarm','INFOPLIST_FILE':'AntFarm/Info.plist','CODE_SIGN_STYLE':'Automatic','ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon','MARKETING_VERSION':'0.1.0','CURRENT_PROJECT_VERSION':'1','GENERATE_INFOPLIST_FILE':'NO','ENABLE_PREVIEWS':'YES'})
            if kind == 'ui': settings.update({'PRODUCT_NAME':'AntFarmUITests','PRODUCT_BUNDLE_IDENTIFIER':'com.owningturtle.antfarm.uitests','GENERATE_INFOPLIST_FILE':'YES','TEST_TARGET_NAME':'AntFarm','CODE_SIGN_STYLE':'Automatic'})
            body = ' '.join(f'{k} = {quoted(v)};' for k,v in settings.items())
            ids.append(obj(name+mode,f'isa = XCBuildConfiguration; buildSettings = {{ {body} }}; name = {mode};'))
        return obj(name+'list',f'isa = XCConfigurationList; buildConfigurations = ({",".join(ids)}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
    app_configs = config_list('app-config','app'); ui_configs = config_list('ui-config','ui'); project_configs = config_list('project-config','project')
    app_target = obj('app-target',f'isa = PBXNativeTarget; buildConfigurationList = {app_configs}; buildPhases = ({app_phase},{app_frameworks},{resource_phase}); buildRules = (); dependencies = (); name = AntFarm; productName = AntFarm; productReference = {app_product}; productType = "com.apple.product-type.application";')
    proxy = obj('app-proxy',f'isa = PBXContainerItemProxy; containerPortal = {uid("project")}; proxyType = 1; remoteGlobalIDString = {app_target}; remoteInfo = AntFarm;')
    dependency = obj('ui-dependency',f'isa = PBXTargetDependency; target = {app_target}; targetProxy = {proxy};')
    ui_target = obj('ui-target',f'isa = PBXNativeTarget; buildConfigurationList = {ui_configs}; buildPhases = ({ui_phase},{ui_frameworks}); buildRules = (); dependencies = ({dependency}); name = AntFarmUITests; productName = AntFarmUITests; productReference = {ui_product}; productType = "com.apple.product-type.bundle.ui-testing";')
    project = obj('project',f'isa = PBXProject; attributes = {{ LastUpgradeCheck = 1640; BuildIndependentTargetsInParallel = YES; TargetAttributes = {{ {app_target} = {{CreatedOnToolsVersion = 16.4;}}; {ui_target} = {{CreatedOnToolsVersion = 16.4; TestTargetID = {app_target};}}; }}; }}; buildConfigurationList = {project_configs}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en,Base); mainGroup = {group}; productRefGroup = {products}; projectDirPath = ""; projectRoot = ""; targets = ({app_target},{ui_target});')
    directory = ROOT/'AntFarm.xcodeproj'; directory.mkdir(exist_ok=True)
    text = '// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'
    text += '\n'.join(f'{key} = {{ {body} }};' for key,body in objects.items())
    text += f'\n}}; rootObject = {project}; }}\n'
    (directory/'project.pbxproj').write_text(text)
    schemes = directory/'xcshareddata/xcschemes'; schemes.mkdir(parents=True,exist_ok=True)
    def reference(target,name):
        return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="{name}" BlueprintName="{name.split(".")[0]}" ReferencedContainer="container:AntFarm.xcodeproj"/>'
    scheme = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1640" version="1.3">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries>
    <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{reference(app_target,'AntFarm.app')}</BuildActionEntry>
  </BuildActionEntries></BuildAction>
  <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{reference(ui_target,'AntFarmUITests.xctest')}</TestableReference></Testables></TestAction>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference(app_target,'AntFarm.app')}</BuildableProductRunnable></LaunchAction>
  <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference(app_target,'AntFarm.app')}</BuildableProductRunnable></ProfileAction>
  <AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>'''
    (schemes/'AntFarm.xcscheme').write_text(scheme)
    print('Generated AntFarm.xcodeproj and original pixel app icon.')

if __name__ == '__main__': generate()
