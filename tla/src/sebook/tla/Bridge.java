package sebook.tla;

import com.google.gson.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import pcal.Translator;
import pcal.ValidationCallBack;
import pcal.PcalParams;
import tla2sany.drivers.SANY;
import tla2sany.modanalyzer.SpecObj;
import tla2sany.semantic.Errors;
import tla2sany.st.Location;
import tlc2.TLC;
import tlc2.TLCGlobals;
import tlc2.output.MP;
import util.ToolIO;

/** Version-one JSON boundary for the official TLA+ tools. Calls are serialized per browser JVM. */
public final class Bridge {
    private static final Gson JSON = new GsonBuilder().disableHtmlEscaping().create();
    private static Exploration exploration;
    private static boolean sessionStarted;

    static {
        System.setProperty("javax.management.builder.initial", BrowserMBeanServerBuilder.class.getName());
        System.setProperty("tlc2.tool.fp.FPSet.impl", "tlc2.tool.fp.MSBDiskFPSet");
        System.setProperty("tlc2.overrides.TLCOverrides", BrowserOverrides.class.getName());
    }

    private Bridge() { }

    public static synchronized String execute(String requestJson) {
        BoundedOutput output = new BoundedOutput();
        PrintStream originalOut = System.out;
        PrintStream originalErr = System.err;
        PrintStream toolOut = ToolIO.out;
        PrintStream toolErr = ToolIO.err;
        JsonObject response;
        try (PrintStream capture = new PrintStream(output, true, "UTF-8")) {
            System.setOut(capture);
            System.setErr(capture);
            ToolIO.out = capture;
            ToolIO.err = capture;
            ToolIO.reset();
            ToolIO.setMode(ToolIO.SYSTEM);
            response = dispatch(JsonParser.parseString(requestJson).getAsJsonObject());
        } catch (Exception | LinkageError error) {
            response = result("error", "request-or-engine-error");
            diagnostic(response, error.getMessage() == null ? error.toString() : error.getMessage());
        } finally {
            ToolIO.setMode(ToolIO.SYSTEM);
            System.setOut(originalOut);
            System.setErr(originalErr);
            ToolIO.out = toolOut;
            ToolIO.err = toolErr;
        }
        response.addProperty("output", new String(output.toByteArray(), StandardCharsets.UTF_8));
        response.addProperty("outputTruncated", output.truncated);
        if (response.get("status").getAsString().equals("error") && response.getAsJsonArray("diagnostics").size() == 0)
            diagnostic(response, "The TLA+ tools rejected this model. See the engine output for details.");
        return JSON.toJson(response);
    }

    private static JsonObject dispatch(JsonObject request) throws Exception {
        String operation = string(request, "operation", "check");
        if (operation.equals("explore-next")) return requireExploration().next(string(request, "stateId", ""));
        if (operation.equals("explore-eval") || operation.equals("evaluate"))
            return requireExploration().evaluate(string(request, "stateId", ""), string(request, "operator", ""));
        if (operation.equals("reset")) {
            closeExploration();
            return result("complete", "reset");
        }
        if (!operation.equals("check") && !operation.equals("parse") && !operation.equals("explore-init"))
            throw new IllegalArgumentException("Unknown operation: " + operation);
        // TLC is a command-line engine with process-wide state, including liveness errors.
        // New models need a fresh JVM; do not try to reset undocumented private fields.
        if (sessionStarted) {
            JsonObject response = result("error", "fresh-session-required");
            diagnostic(response, "Create a fresh browser JVM for each parse, check, or exploration session.");
            return response;
        }
        sessionStarted = true;
        configureGlobals();
        Workspace workspace = new Workspace(request);
        boolean retained = false;
        try {
            JsonObject generated = new JsonObject();
            if (request.has("translatePlusCal") && request.get("translatePlusCal").getAsBoolean()) {
                JsonObject translationError = translate(workspace, generated);
                if (translationError != null) return translationError;
            }
            JsonObject response;
            if (operation.equals("parse")) response = parse(workspace);
            else if (operation.equals("explore-init")) {
                exploration = new Exploration(workspace, boundedInt(request, "maxChoices", 200, 1000));
                response = exploration.initial();
                retained = true;
            } else response = check(workspace, request);
            if (generated.size() > 0) response.add("generatedFiles", generated);
            return response;
        } finally {
            if (!retained) {
                exploration = null;
                workspace.close();
            }
        }
    }

    private static JsonObject translate(Workspace workspace, JsonObject generated) throws IOException {
        for (String module : workspace.modules) {
            String source = workspace.source(module);
            // Use the same markers that the upstream translator searches for.
            if (!source.contains(PcalParams.BeginAlg) && !source.contains(PcalParams.BeginFairAlg)) continue;
            JsonObject error = translateModule(workspace, module, source, generated);
            if (error != null) return error;
        }
        return null;
    }

    private static JsonObject translateModule(Workspace workspace, String module, String source, JsonObject generated) throws IOException {
        Translator translator = new Translator(source, new String[] { workspace.path(module).toString() });
        boolean translated = translator.translate(new ValidationCallBack.Noop());
        ToolIO.setMode(ToolIO.SYSTEM);
        if (!translated) {
            JsonObject response = result("error", "pluscal-translation");
            for (Translator.Error error : translator.getErrors()) {
                JsonObject diagnostic = diagnostic(response, error.toString());
                diagnostic.addProperty("file", module);
                int[] location = error.getLocation();
                if (location != null) {
                    diagnostic.addProperty("line", location[0]);
                    diagnostic.addProperty("column", location[1]);
                }
            }
            return response;
        }
        workspace.write(module, translator.getOutput());
        workspace.locations.translated(module, translator.getMapping());
        generated.addProperty(module, translator.getOutput());
        return null;
    }

    private static JsonObject parse(Workspace workspace) throws Exception {
        SpecObj spec = new SpecObj(workspace.path(workspace.entry).toString(), workspace.resolver());
        int code = SANY.frontEndMain(spec, workspace.entry, ToolIO.out);
        boolean valid = code == 0 && spec.getParseErrors().isSuccess() && spec.getSemanticErrors().isSuccess();
        JsonObject response = result(valid ? "complete" : "error", valid ? "parsed" : "parse-error");
        errors(response, spec.getParseErrors());
        errors(response, spec.getSemanticErrors());
        return response;
    }

    private static void errors(JsonObject response, Errors errors) {
        for (String error : errors.getErrors()) diagnostic(response, error);
    }

    private static JsonObject check(Workspace workspace, JsonObject request) throws InterruptedException {
        CheckRecorder recorder = new CheckRecorder(boundedInt(request, "maxTraceStates", 500, 2000), workspace.locations);
        RunBudget budget = new RunBudget(request);
        TLC checker = new TLC();
        List<String> arguments = new ArrayList<>();
        java.util.Collections.addAll(arguments, "-workers", "1", "-fp", "0", "-seed", "0", "-fpmem", "0.01", "-noGenerateSpecTE",
                "-config", workspace.path(workspace.config).toString(), "-metadir", workspace.path("states").toString());
        if (request.has("checkDeadlock") && !request.get("checkDeadlock").getAsBoolean()) arguments.add("-deadlock");
        arguments.add(workspace.path(workspace.entry).toString());
        if (!checker.handleParameters(arguments.toArray(new String[0]))) return result("error", "configuration-error");
        checker.setResolver(workspace.resolver());
        MP.setRecorder(recorder);
        Thread monitor = new Thread(budget, "sebook-tla-budget");
        monitor.setDaemon(true);
        monitor.start();
        int code;
        try { code = checker.process(); }
        finally {
            budget.finished = true;
            monitor.interrupt();
            monitor.join();
            MP.unsubscribeRecorder(recorder);
        }
        JsonObject response = recorder.result();
        response.addProperty("engineCode", code);
        if (budget.exceeded != null) {
            response.addProperty("status", "incomplete");
            response.addProperty("reason", budget.exceeded);
        } else if (BrowserOverrides.stopRequested) {
            response.addProperty("status", "incomplete");
            response.addProperty("reason", "engine-stop");
            diagnostic(response, "The model requested early termination with TLCSet(\"exit\", TRUE).");
        } else if (recorder.complete && TLCGlobals.mainChecker != null
                && TLCGlobals.mainChecker.getStateQueueSize() != 0) {
            // TLCSet("exit", TRUE) can cause upstream TLC_SUCCESS before queue exhaustion.
            response.addProperty("status", "incomplete");
            response.addProperty("reason", "unfinished-state-space");
            diagnostic(response, "The checker stopped with unexplored states remaining.");
        }
        return response;
    }

    private static final class RunBudget implements Runnable {
        private final long deadline;
        private final long maxStates;
        volatile boolean finished;
        volatile String exceeded;

        RunBudget(JsonObject request) {
            long milliseconds = request.has("maxTimeMs") ? request.get("maxTimeMs").getAsLong() : 30000;
            maxStates = request.has("maxStates") ? request.get("maxStates").getAsLong() : 100000;
            if (milliseconds < 1 || maxStates < 1) throw new IllegalArgumentException("Run budgets must be positive.");
            deadline = System.nanoTime() + Math.min(milliseconds, 300000) * 1000000;
        }

        @Override public void run() {
            try {
                while (!finished) {
                    if (System.nanoTime() >= deadline) exceeded = "time-limit";
                    if (TLCGlobals.mainChecker != null && TLCGlobals.mainChecker.getDistinctStatesGenerated() > maxStates)
                        exceeded = "state-limit";
                    if (exceeded != null && TLCGlobals.mainChecker != null) TLCGlobals.mainChecker.stop();
                    Thread.sleep(10);
                }
            } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
        }
    }

    private static void configureGlobals() {
        TLCGlobals.mainChecker = null;
        TLCGlobals.simulator = null;
        TLCGlobals.DFIDMax = -1;
        TLCGlobals.continuation = false;
        TLCGlobals.tool = false;
        TLCGlobals.metaDir = null;
        TLCGlobals.setNumWorkers(1);
    }

    private static Exploration requireExploration() {
        if (exploration == null) throw new IllegalStateException("No exploration session. Start exploration first.");
        return exploration;
    }

    private static void closeExploration() throws IOException {
        if (exploration != null) exploration.close();
        exploration = null;
    }

    static String string(JsonObject object, String key, String fallback) {
        return object.has(key) ? object.get(key).getAsString() : fallback;
    }

    static JsonObject result(String status, String reason) {
        JsonObject result = new JsonObject();
        result.addProperty("version", 1);
        result.addProperty("engine", "TLA+ tools 1.8.0 / 56d37a9b7bf529086fd961160e0b8975e224eafc");
        result.addProperty("status", status);
        result.addProperty("reason", reason);
        result.add("diagnostics", new JsonArray());
        return result;
    }

    private static JsonObject diagnostic(JsonObject response, String message) {
        JsonObject diagnostic = new JsonObject();
        diagnostic.addProperty("message", message);
        Location[] locations = Location.getParsedLocations(message);
        if (locations.length > 0) {
            StateValues.location(locations[0]).entrySet().forEach(entry -> diagnostic.add(entry.getKey(), entry.getValue()));
        }
        response.getAsJsonArray("diagnostics").add(diagnostic);
        return diagnostic;
    }

    private static int boundedInt(JsonObject request, String name, int fallback, int maximum) {
        int value = request.has(name) ? request.get(name).getAsInt() : fallback;
        if (value < 1 || value > maximum) throw new IllegalArgumentException(name + " must be between 1 and " + maximum + ".");
        return value;
    }

    private static final class BoundedOutput extends ByteArrayOutputStream {
        private static final int LIMIT = 256 * 1024;
        boolean truncated;
        @Override public synchronized void write(int value) {
            if (count < LIMIT) super.write(value); else truncated = true;
        }
        @Override public synchronized void write(byte[] bytes, int offset, int length) {
            int retained = Math.min(length, LIMIT - count);
            super.write(bytes, offset, retained);
            if (retained < length) truncated = true;
        }
    }

    /** Native integration-test entry point: one JSON request and response per line. */
    public static void main(String[] args) throws IOException {
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        String line;
        while ((line = input.readLine()) != null) System.out.println(execute(line));
        closeExploration();
    }
}
