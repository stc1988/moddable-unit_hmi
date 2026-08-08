import Modules from "modules";

interface ModModule {
	main(): Promise<void> | void;
}

if (Modules.has("mod")) {
	const mod = Modules.importNow("mod") as ModModule;
	await mod.main();
} else {
	trace("No module found.\n");
}
