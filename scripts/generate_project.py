#!/usr/bin/env python3
"""Generate a dependency-free Xcode project with app, unit, and UI-test targets."""
from pathlib import Path
import hashlib

ROOT = Path(__file__).resolve().parents[1]

def uid(name):
    return hashlib.sha1(name.encode()).hexdigest()[:24].upper()

objects = []
def obj(name, body):
    objects.append(f'\t\t{uid(name)} = {{ {body} }};')
    return uid(name)

def ids(names):
    return '(' + ', '.join(uid(n) for n in names) + ',)'

targets = {
    'AntFarm': {'files': sorted(str(p.relative_to(ROOT)) for p in (ROOT/'AntFarm').rglob('*.swift')),
                'product': 'application', 'extension': 'app'},
    'AntFarmTests': {'files': ['AntFarmTests/ReferenceWorldTests.swift'],
                     'product': 'bundle.unit-test', 'extension': 'xctest'},
    'AntFarmUITests': {'files': ['AntFarmUITests/DesignPreviewUITests.swift'],
                       'product': 'bundle.ui-testing', 'extension': 'xctest'},
}
all_refs = []
for name, target in targets.items():
    for path in target['files']:
        obj('ref:'+path, f'isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "{path}"; sourceTree = SOURCE_ROOT;')
        obj('build:'+path, f'isa = PBXBuildFile; fileRef = {uid("ref:"+path)};')
        all_refs.append('ref:'+path)
    obj('product:'+name, f'isa = PBXFileReference; explicitFileType = {"wrapper.application" if name == "AntFarm" else "wrapper.cfbundle"}; includeInIndex = 0; path = {name}.{target["extension"]}; sourceTree = BUILT_PRODUCTS_DIR;')
    obj('sources:'+name, f'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = {ids(["build:"+p for p in target["files"]])}; runOnlyForDeploymentPostprocessing = 0;')
    obj('frameworks:'+name, 'isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')

resources = ['AntFarm/Resources/reference-world.json', 'AntFarm/Resources/ReferenceWorld.png']
for path in resources:
    filetype = 'image.png' if path.endswith('.png') else 'text.json'
    obj('ref:'+path, f'isa = PBXFileReference; lastKnownFileType = {filetype}; path = "{path}"; sourceTree = SOURCE_ROOT;')
    obj('build:'+path, f'isa = PBXBuildFile; fileRef = {uid("ref:"+path)};')
    all_refs.append('ref:'+path)
obj('ref:info', 'isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = "AntFarm/Info.plist"; sourceTree = SOURCE_ROOT;')
all_refs.append('ref:info')
obj('resources:AntFarm', f'isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = {ids(["build:"+p for p in resources])}; runOnlyForDeploymentPostprocessing = 0;')

for name, target in targets.items():
    deps = '()'
    if name != 'AntFarm':
        obj('proxy:'+name, f'isa = PBXContainerItemProxy; containerPortal = {uid("project")}; proxyType = 1; remoteGlobalIDString = {uid("target:AntFarm")}; remoteInfo = AntFarm;')
        obj('dependency:'+name, f'isa = PBXTargetDependency; target = {uid("target:AntFarm")}; targetProxy = {uid("proxy:"+name)};')
        deps = ids(['dependency:'+name])
    phases = ['sources:'+name, 'frameworks:'+name]
    if name == 'AntFarm': phases.append('resources:AntFarm')
    obj('target:'+name, f'isa = PBXNativeTarget; buildConfigurationList = {uid("configs:"+name)}; buildPhases = {ids(phases)}; buildRules = (); dependencies = {deps}; name = {name}; productName = {name}; productReference = {uid("product:"+name)}; productType = "com.apple.product-type.{target["product"]}";')
    for config in ['Debug', 'Release']:
        settings = {
            'CODE_SIGN_STYLE':'Automatic', 'CURRENT_PROJECT_VERSION':'1', 'MARKETING_VERSION':'0.1.0',
            'PRODUCT_BUNDLE_IDENTIFIER':f'com.owningturtle.antfarm{("."+name) if name != "AntFarm" else ""}',
            'PRODUCT_NAME':'"$(TARGET_NAME)"', 'SWIFT_VERSION':'5.0', 'TARGETED_DEVICE_FAMILY':'1',
            'SUPPORTED_PLATFORMS':'"iphoneos iphonesimulator"', 'SUPPORTS_MACCATALYST':'NO',
            'SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD':'NO', 'SWIFT_EMIT_LOC_STRINGS':'YES',
            'LD_RUNPATH_SEARCH_PATHS':'"$(inherited) @executable_path/Frameworks"',
        }
        if name == 'AntFarm':
            settings.update({'GENERATE_INFOPLIST_FILE':'NO', 'INFOPLIST_FILE':'"AntFarm/Info.plist"',
                             'ENABLE_PREVIEWS':'YES'})
        else:
            settings.update({'GENERATE_INFOPLIST_FILE':'YES'})
            if name == 'AntFarmTests':
                settings.update({'BUNDLE_LOADER':'"$(TEST_HOST)"',
                                 'TEST_HOST':'"$(BUILT_PRODUCTS_DIR)/AntFarm.app/AntFarm"'})
            else:
                settings.update({'TEST_TARGET_NAME':'AntFarm'})
        content = ' '.join(f'{k} = {v};' for k,v in settings.items())
        obj('config:'+name+config, f'isa = XCBuildConfiguration; buildSettings = {{ {content} }}; name = {config};')
    obj('configs:'+name, f'isa = XCConfigurationList; buildConfigurations = {ids(["config:"+name+c for c in ["Debug","Release"]])}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')

for config in ['Debug','Release']:
    settings = {'ALWAYS_SEARCH_USER_PATHS':'NO', 'CLANG_ENABLE_MODULES':'YES',
                'CLANG_ENABLE_OBJC_ARC':'YES', 'IPHONEOS_DEPLOYMENT_TARGET':'17.0',
                'SDKROOT':'iphoneos', 'SWIFT_VERSION':'5.0', 'SWIFT_STRICT_CONCURRENCY':'targeted',
                'GCC_C_LANGUAGE_STANDARD':'gnu17', 'CLANG_CXX_LANGUAGE_STANDARD':'"gnu++20"',
                'DEBUG_INFORMATION_FORMAT':'dwarf' if config=='Debug' else '"dwarf-with-dsym"',
                'SWIFT_OPTIMIZATION_LEVEL':'"-Onone"' if config=='Debug' else '"-O"',
                'ENABLE_TESTABILITY':'YES' if config=='Debug' else 'NO',
                'SWIFT_ACTIVE_COMPILATION_CONDITIONS':'"DEBUG $(inherited)"' if config=='Debug' else '"$(inherited)"'}
    if config=='Release': settings['SWIFT_COMPILATION_MODE']='wholemodule'
    obj('projectconfig:'+config, f'isa = XCBuildConfiguration; buildSettings = {{ '+ ' '.join(f'{k} = {v};' for k,v in settings.items()) + f' }}; name = {config};')
obj('projectconfigs', f'isa = XCConfigurationList; buildConfigurations = {ids(["projectconfig:Debug","projectconfig:Release"])}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
obj('products', f'isa = PBXGroup; children = {ids(["product:"+n for n in targets])}; name = Products; sourceTree = "<group>";')
obj('main', f'isa = PBXGroup; children = {ids(all_refs+["products"])}; sourceTree = "<group>";')
obj('project', f'isa = PBXProject; attributes = {{ BuildIndependentTargetsInParallel = YES; LastSwiftUpdateCheck = 1600; LastUpgradeCheck = 1600; }}; buildConfigurationList = {uid("projectconfigs")}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en, Base,); mainGroup = {uid("main")}; productRefGroup = {uid("products")}; projectDirPath = ""; projectRoot = ""; targets = {ids(["target:"+n for n in targets])};')
(ROOT/'AntFarm.xcodeproj/project.pbxproj').write_text('// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {};\n\tobjectVersion = 56;\n\tobjects = {\n'+'\n'.join(objects)+'\n\t};\n\trootObject = '+uid('project')+';\n}\n')

def reference(name):
    ext = targets[name]['extension']
    return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{uid("target:"+name)}" BuildableName="{name}.{ext}" BlueprintName="{name}" ReferencedContainer="container:AntFarm.xcodeproj"/>'

scheme = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
    <BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{reference('AntFarm')}</BuildActionEntry></BuildActionEntries>
  </BuildAction>
  <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES">
    <Testables><TestableReference skipped="NO" parallelizable="NO">{reference('AntFarmTests')}</TestableReference><TestableReference skipped="NO" parallelizable="NO">{reference('AntFarmUITests')}</TestableReference></Testables>
  </TestAction>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference('AntFarm')}</BuildableProductRunnable></LaunchAction>
  <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference('AntFarm')}</BuildableProductRunnable></ProfileAction>
  <AnalyzeAction buildConfiguration="Debug"/>
  <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
'''
(ROOT/'AntFarm.xcodeproj/xcshareddata/xcschemes/AntFarm.xcscheme').write_text(scheme)
print('Generated Xcode app, unit-test, UI-test targets and shared scheme.')
