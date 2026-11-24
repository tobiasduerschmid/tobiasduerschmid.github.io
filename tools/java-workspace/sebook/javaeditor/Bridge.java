package sebook.javaeditor;

import com.google.gson.*;
import java.io.*;
import java.util.*;

/** One compiler workspace per disposable runtime frame. Source edits invalidate all dependent class files. */
public final class Bridge {
    private static final Gson JSON = new Gson();
    private static final Map<String,JavaBuild> harnesses = new LinkedHashMap<>();
    private static Map<String,String> files;
    private static JavaBuild project;

    public static void initialize() {
        Program.trapExit();
    }

    public static String execute(String json) throws Exception {
        JsonObject request = JsonParser.parseString(json).getAsJsonObject();
        Map<String,String> snapshot = new TreeMap<>();
        for (Map.Entry<String,JsonElement> entry : request.getAsJsonObject("files").entrySet()) snapshot.put(entry.getKey(), entry.getValue().getAsString());
        if (!snapshot.equals(files)) {
            String changed = singleChangedSource(snapshot);
            if (changed == null || !project.updateBody(changed, snapshot.get(changed))) {
                // Publish all compiled artifacts together. Failed revisions can never execute.
                JavaBuild next = new JavaBuild(snapshot, Collections.emptyMap(), true);
                harnesses.clear();
                project = next;
            }
            files = snapshot;
        }
        String operation = request.get("operation").getAsString();
        if ("analyze".equals(operation)) {
            JsonObject semantics = new JsonObject();
            semantics.add("bindings", project.bindings);
            semantics.addProperty("success", project.success);
            semantics.add("diagnostics", project.diagnostics);
            return semantics.toString();
        }
        if (!project.success) return compileError(project).toString();
        JavaBuild build = project;
        Map<String,byte[]> classpath = project.classes;
        boolean debug = "debug".equals(operation);
        String entry = request.has("entry") ? request.get("entry").getAsString() : null;
        if ("test".equals(operation)) {
            String code = request.get("code").getAsString();
            build = harnesses.get(code);
            if (build == null) {
                if (harnesses.size() >= 64) harnesses.clear();
                build = new JavaBuild(JavaBuild.harness(code), project.classes, false);
                harnesses.put(code, build);
            }
            if (!build.success) return compileError(build).toString();
            entry = build.types.keySet().iterator().next();
            classpath = new HashMap<>(project.classes);
            classpath.putAll(build.classes);
        } else if (debug) {
            classpath = Debug.prepare(project.classes, files.keySet().toArray(new String[0]));
        } else if (!"run".equals(operation)) throw new IllegalArgumentException("Unknown Java operation.");
        List<String> names = new ArrayList<>();
        if (entry != null) names.addAll(build.types.getOrDefault(entry, Collections.emptyList()));
        else for (List<String> classes : build.types.values()) names.addAll(classes);
        // With multiple entry points in one source file, use the class named by that file first.
        if (entry != null) {
            String simple = new File(entry).getName().replaceFirst("\\.java$", "");
            names.sort(Comparator.comparing(name -> !(name.equals(simple) || name.endsWith("." + simple))));
        }
        String[] args = request.has("args") ? JSON.fromJson(request.get("args"), String[].class) : new String[0];
        boolean assertions = "test".equals(operation) || request.has("assertions") && request.get("assertions").getAsBoolean();
        JsonObject result = Program.run(names, classpath, args, debug, assertions);
        result.add("diagnostics", build.diagnostics);
        return result.toString();
    }

    private static String singleChangedSource(Map<String,String> snapshot) {
        if (files == null || !files.keySet().equals(snapshot.keySet())) return null;
        String changed = null;
        for (Map.Entry<String,String> file : snapshot.entrySet()) {
            if (file.getValue().equals(files.get(file.getKey()))) continue;
            if (changed != null) return null;
            changed = file.getKey();
        }
        return changed;
    }

    private static JsonObject compileError(JavaBuild build) {
        JsonObject result = new JsonObject();
        result.addProperty("exitCode", 1);
        result.addProperty("stdout", "");
        result.addProperty("stderr", build.compilerOutput);
        result.add("diagnostics", build.diagnostics);
        return result;
    }

}
