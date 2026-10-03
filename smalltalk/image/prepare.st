"Executed from an isolated directory containing only verified pinned inputs."
[ | repository names probe |
repository := MCDirectoryRepository new directory: FileDirectory default.
names := (FileStream readOnlyFileNamed: 'packages.txt' do: [:stream | stream contents]) lines.
names do: [:name | (repository loadVersionFromFileNamed: name) load].
"Retain all native Core/Tests packages, but omit optional English dictionary initialization.
English spelling lint and its data-dependent tests are unavailable in this runtime."
#('SEBookWorkspace.st' 'SEBookChanges.st' 'SEBookTransactions.st' 'SEBookInspector.st' 'SEBookBrowser.st' 'SEBookRefactorings.st' 'SEBookStructuralGuard.st' 'SEBookService.st') do: [:name |
    FileStream readOnlyFileNamed: name do: [:stream | stream fileIn]].
Smalltalk at: #SEBookCheckpointRoots put: (Array with: 1 with: nil with: #() with: nil).
probe := SEBookService new info.
FileStream forceNewFileNamed: 'semantic-probe.json' do: [:stream | WebUtils jsonObj: probe on: stream].
FileStream forceNewFileNamed: 'Squeak-LICENSE' do: [:stream | stream nextPutAll: Smalltalk license].
"No UI startup, networking services, or old build package repositories in the distribution."
Smalltalk removeFromStartUpList: Project.
Smalltalk removeFromStartUpList: UIManager.
Smalltalk removeFromStartUpList: ReleaseBuilder.
Smalltalk removeFromStartUpList: AutoStart.
MCWorkingCopy allManagers do: [:workingCopy |
    workingCopy repositoryGroup repositories copy do: [:repositoryToRemove |
        workingCopy repositoryGroup removeRepository: repositoryToRemove]].
MCRepositoryGroup default repositories copy do: [:repositoryToRemove | MCRepositoryGroup default removeRepository: repositoryToRemove].
Smalltalk garbageCollect.
SEBookService saveAndServe.
Processor activeProcess terminate.
] on: Error do: [:error |
    FileStream forceNewFileNamed: 'build-error.txt' do: [:stream |
        stream nextPutAll: error description; cr.
        error signalerContext errorReportOn: stream].
    Smalltalk quitPrimitive: 1].
