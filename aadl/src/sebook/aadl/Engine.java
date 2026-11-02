package sebook.aadl;

import com.google.inject.Injector;
import org.eclipse.emf.ecore.plugin.EcorePlugin;
import org.osate.aadl.ls.setup.Aadl2LsSetup;
import org.osate.aadl.ls.setup.BehaviorAnnexLsSetup;
import org.osate.aadl.ls.setup.ErrorModelLsSetup;

/** Immutable language services; mutable model resources belong to a submission. */
final class Engine {
    private static Injector injector;

    private Engine() { }

    static synchronized Injector initialize() {
        if (injector == null) {
            EcorePlugin.ExtensionProcessor.process(null);
            Injector candidate = new Aadl2LsSetup().createInjectorAndDoEMFRegistration();
            new ErrorModelLsSetup().createInjectorAndDoEMFRegistration();
            new BehaviorAnnexLsSetup().createInjectorAndDoEMFRegistration();
            injector = candidate;
        }
        return injector;
    }
}
