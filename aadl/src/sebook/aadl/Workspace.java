package sebook.aadl;

import com.google.gson.JsonObject;
import com.google.inject.Injector;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Comparator;
import java.io.IOException;
import org.eclipse.emf.common.util.URI;
import org.eclipse.emf.ecore.resource.Resource;
import org.eclipse.xtext.resource.XtextResourceSet;
import org.eclipse.xtext.util.CancelIndicator;
import org.eclipse.xtext.validation.CheckMode;
import org.eclipse.xtext.validation.IResourceValidator;
import org.osate.aadl2.AadlPackage;
import org.osate.aadl2.ComponentImplementation;
import org.osate.aadl2.PackageSection;
import org.osate.aadl2.instance.SystemInstance;
import org.osate.aadl2.instantiation.InstantiateModel;
import org.osate.aadl2.modelsupport.errorreporting.AnalysisErrorReporterManager;
import org.osate.aadl2.modelsupport.errorreporting.QueuingAnalysisErrorReporter;

/** Loads the complete source snapshot through the official Xtext/OSATE setup. */
final class Workspace implements AutoCloseable {
    private final String root;
    private final boolean analyze;
    private final Injector injector;
    private final XtextResourceSet resources;
    private final List<Resource> sources = new ArrayList<>();
    private final Path directory;

    Workspace(JsonObject request) throws Exception {
        if (!request.has("version") || request.get("version").getAsInt() != 1) throw new IllegalArgumentException("Unsupported protocol version.");
        String operation = request.get("operation").getAsString();
        if (!List.of("validate", "analyze").contains(operation)) throw new IllegalArgumentException("Unknown operation.");
        analyze = operation.equals("analyze");
        root = request.get("root").getAsString();
        JsonObject files = request.getAsJsonObject("files");
        validateFiles(files);
        injector = Engine.initialize();
        resources = new XtextResourceSet();
        injector.injectMembers(resources);
        Path base = Path.of(java.lang.System.getProperty("sebook.aadl.workRoot", java.lang.System.getProperty("java.io.tmpdir")), "sebook-aadl");
        Files.createDirectories(base);
        directory = Files.createTempDirectory(base, "snapshot-");
        for (var entry : files.entrySet()) {
            Path path = directory.resolve(entry.getKey());
            Files.createDirectories(path.getParent());
            Files.writeString(path, entry.getValue().getAsString());
        }
        for (var entry : files.entrySet()) {
            Resource source = resources.getResource(URI.createFileURI(directory.resolve(entry.getKey()).toString()), true);
            SourceLocations.attach(source, entry.getKey());
            sources.add(source);
        }
    }

    boolean analyze() { return analyze; }

    @Override
    public void close() throws IOException {
        for (Resource resource : List.copyOf(resources.getResources())) resource.unload();
        resources.getResources().clear();
        resources.getURIResourceMap().clear();
        try (var paths = Files.walk(directory)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.delete(path);
        }
    }

    private static void validateFiles(JsonObject files) {
        if (files == null || files.size() == 0 || files.size() > 32) throw new IllegalArgumentException("Supply 1–32 AADL files.");
        long size = 0;
        for (var entry : files.entrySet()) {
            String name = entry.getKey();
            if (!name.matches("[A-Za-z0-9_/-]+\\.aadl") || name.startsWith("/") || name.contains("..")) throw new IllegalArgumentException("Invalid AADL filename.");
            size += entry.getValue().getAsString().length();
        }
        if (size > 500_000) throw new IllegalArgumentException("The source snapshot exceeds 500,000 characters.");
    }

    SystemInstance instantiate(List<Map<String, Object>> diagnostics) throws Exception {
        IResourceValidator validator = injector.getInstance(IResourceValidator.class);
        for (Resource source : sources) {
            for (var issue : validator.validate(source, CheckMode.ALL, CancelIndicator.NullImpl)) {
                Map<String, Object> diagnostic = new LinkedHashMap<>();
                diagnostic.put("severity", issue.getSeverity().toString().toLowerCase());
                diagnostic.put("message", issue.getMessage());
                diagnostic.put("file", SourceLocations.file(source));
                diagnostic.put("line", issue.getLineNumber());
                diagnostic.put("column", issue.getColumn());
                diagnostics.add(diagnostic);
            }
        }
        if (diagnostics.stream().anyMatch(item -> "error".equals(item.get("severity")))) return null;
        ComponentImplementation implementation = findRoot();
        if (implementation == null) {
            diagnostics.add(Map.of("severity", "error", "message", "Component implementation not found: " + root));
            return null;
        }
        var errors = new AnalysisErrorReporterManager(QueuingAnalysisErrorReporter.factory);
        SystemInstance instance = InstantiateModel.instantiate(implementation, errors);
        for (Resource source : List.copyOf(resources.getResources())) {
            var reporter = (QueuingAnalysisErrorReporter) errors.getReporter(source);
            for (var message : reporter.getErrors()) {
                var diagnostic = new LinkedHashMap<String, Object>(Projection.location(message.where));
                diagnostic.put("severity", message.kind.toString().toLowerCase());
                diagnostic.put("message", message.message);
                diagnostics.add(diagnostic);
            }
        }
        return errors.getNumErrors() == 0 && errors.getNumInternalErrors() == 0 ? instance : null;
    }

    private ComponentImplementation findRoot() {
        for (Resource source : sources) {
            if (source.getContents().isEmpty() || !(source.getContents().get(0) instanceof AadlPackage pkg)) continue;
            for (PackageSection section : new PackageSection[] {pkg.getPublicSection(), pkg.getPrivateSection()}) {
                if (section == null) continue;
                for (var classifier : section.getOwnedClassifiers()) {
                    if (classifier instanceof ComponentImplementation implementation && root.equalsIgnoreCase(classifier.getQualifiedName())) return implementation;
                }
            }
        }
        return null;
    }
}
