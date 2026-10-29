package sebook.tla;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import tlc2.output.EC;
import tlc2.output.MP;
import tlc2.output.IMessagePrinterRecorder;
import tla2sany.st.Location;
import tlc2.tool.TLCStateInfo;

/** Adapts TLC's machine event codes and actual state objects to the versioned browser result. */
final class CheckRecorder implements IMessagePrinterRecorder {
    final JsonArray states = new JsonArray();
    final JsonArray diagnostics = new JsonArray();
    final JsonObject stats = new JsonObject();
    boolean complete;
    String violation;
    Integer loopIndex;
    private final int maxTraceStates;
    private final SourceLocations sourceLocations;
    private int fullStateCount;
    boolean traceTruncated;

    CheckRecorder(int maxTraceStates, SourceLocations sourceLocations) {
        this.maxTraceStates = maxTraceStates;
        this.sourceLocations = sourceLocations;
    }

    @Override public synchronized void record(int code, Object... objects) {
        if (code == EC.TLC_SUCCESS) complete = true;
        if (code == EC.TLC_STATE_PRINT1 || code == EC.TLC_STATE_PRINT2) {
            fullStateCount++;
            if (states.size() >= maxTraceStates) { traceTruncated = true; return; }
            TLCStateInfo info = (TLCStateInfo) objects[0];
            JsonObject state = StateValues.state("trace-" + states.size(), info.state);
            state.addProperty("action", info.info == null ? "Initial state" : info.info.toString());
            if (info.info != null) {
                Location[] locations = Location.getParsedLocations(info.info.toString());
                if (locations.length > 0) state.add("location", sourceLocations.encode(locations[0]));
            }
            states.add(state);
            return;
        }
        if (code == EC.TLC_STATE_PRINT3) {
            loopIndex = Math.max(0, fullStateCount - 1);
            return;
        }
        if (code == EC.TLC_BACK_TO_STATE && objects.length > 0 && objects[0] instanceof String) {
            loopIndex = Integer.parseInt((String) objects[0]) - 1;
            return;
        }
        if (code == EC.TLC_STATS && objects.length >= 3) {
            stats.addProperty("generated", objects[0].toString());
            stats.addProperty("distinct", objects[1].toString());
            stats.addProperty("remaining", objects[2].toString());
        }
        String kind = violationKind(code);
        if (kind != null) {
            violation = kind;
            String[] args = new String[objects.length];
            for (int i = 0; i < args.length; i++) args[i] = String.valueOf(objects[i]);
            JsonObject diagnostic = new JsonObject();
            diagnostic.addProperty("code", code);
            // The three-argument formatter does not emit another recorder event.
            diagnostic.addProperty("message", MP.getMessage(MP.ERROR, code, args));
            diagnostics.add(diagnostic);
        }
    }

    private static String violationKind(int code) {
        switch (code) {
            case EC.TLC_INVARIANT_VIOLATED_INITIAL:
            case EC.TLC_INVARIANT_VIOLATED_BEHAVIOR: return "invariant";
            case EC.TLC_DEADLOCK_REACHED: return "deadlock";
            case EC.TLC_TEMPORAL_PROPERTY_VIOLATED: return "liveness";
            case EC.TLC_ACTION_PROPERTY_VIOLATED_BEHAVIOR:
            case EC.TLC_PROPERTY_VIOLATED_INITIAL: return "property";
            default: return null;
        }
    }

    JsonObject result() {
        JsonObject result = Bridge.result(violation != null ? "counterexample" : complete ? "complete" : "error",
                violation != null ? violation : complete ? "exhausted-state-space" : "engine-error");
        result.add("diagnostics", diagnostics);
        result.add("stats", stats);
        if (states.size() > 0) {
            JsonObject trace = new JsonObject();
            trace.add("states", states);
            trace.addProperty("kind", violation == null ? "error" : violation);
            if (loopIndex != null && !traceTruncated) trace.addProperty("loopIndex", loopIndex);
            if (loopIndex != null && traceTruncated) trace.addProperty("fullLoopIndex", loopIndex);
            trace.addProperty("truncated", traceTruncated);
            result.add("trace", trace);
        }
        return result;
    }
}
