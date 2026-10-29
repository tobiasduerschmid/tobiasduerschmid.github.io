package sebook.tla;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import tla2sany.semantic.OpDefNode;
import tlc2.tool.Action;
import tlc2.tool.INextStateFunctor;
import tlc2.tool.TLCState;
import tlc2.tool.impl.FastTool;
import tlc2.util.Context;
import tlc2.util.FP64;

/** Retains upstream state objects for a single interactive exploration session. */
final class Exploration implements AutoCloseable {
    private final Workspace workspace;
    private final FastTool tool;
    private final Map<String, TLCState> states = new LinkedHashMap<>();
    private final int maxChoices;

    Exploration(Workspace workspace, int maxChoices) {
        this.workspace = workspace;
        this.maxChoices = maxChoices;
        FP64.Init(0);
        tool = new FastTool(workspace.path(workspace.entry).toString().replaceFirst("\\.tla$", ""),
                workspace.path(workspace.config).toString().replaceFirst("\\.cfg$", ""), workspace.resolver());
    }

    JsonObject initial() {
        JsonObject result = Bridge.result("complete", "initial-states");
        JsonArray initial = new JsonArray();
        try {
            tool.getInitStates(state -> {
                if (initial.size() >= maxChoices) throw new ChoiceLimit();
                if (!state.allAssigned()) throw new IllegalArgumentException("Initial state leaves variables unassigned.");
                initial.add(remember(state));
                return null;
            });
        } catch (ChoiceLimit limit) {
            result.addProperty("status", "incomplete");
            result.addProperty("reason", "choice-limit");
        }
        result.add("states", initial);
        return result;
    }

    JsonObject next(String stateId) {
        TLCState from = get(stateId);
        JsonArray choices = new JsonArray();
        JsonObject result = Bridge.result("complete", "enabled-transitions");
        try {
            tool.getNextStates(new INextStateFunctor() {
              @Override public Object addElement(TLCState state) { throw new IllegalStateException("An action is required."); }
              @Override public Object addElement(TLCState previous, Action action, TLCState successor) {
                if (choices.size() >= maxChoices) throw new ChoiceLimit();
                if (!successor.allAssigned()) throw new IllegalArgumentException("Next state leaves variables unassigned.");
                JsonObject choice = new JsonObject();
                JsonObject state = remember(successor);
                choice.addProperty("id", state.get("id").getAsString());
                choice.addProperty("label", action.getName().toString());
                choice.add("state", state);
                choice.add("location", workspace.locations.encode(action.pred.getLocation()));
                choice.addProperty("withinConstraints", tool.isInModel(successor) && tool.isInActions(from, successor));
                choices.add(choice);
                return null;
              }
            }, from);
        } catch (ChoiceLimit limit) {
            result.addProperty("status", "incomplete");
            result.addProperty("reason", "choice-limit");
        }
        result.add("choices", choices);
        result.add("invariants", invariants(from));
        return result;
    }

    JsonObject evaluate(String stateId, String operator) {
        OpDefNode definition = tool.getSpecProcessor().getRootModule().getOpDef(operator);
        if (definition == null || definition.getArity() != 0)
            throw new IllegalArgumentException("Watch expressions must name a zero-argument operator in the module.");
        JsonObject result = Bridge.result("complete", "expression-value");
        result.add("value", StateValues.value(tool.eval(definition.getBody(), Context.Empty, get(stateId)), 0));
        return result;
    }

    private JsonArray invariants(TLCState state) {
        JsonArray checks = new JsonArray();
        Action[] invariants = tool.getInvariants();
        for (int i = 0; i < invariants.length; i++) {
            JsonObject check = new JsonObject();
            check.addProperty("name", tool.getInvNames()[i]);
            check.addProperty("holds", tool.isValid(invariants[i], state));
            checks.add(check);
        }
        return checks;
    }

    private JsonObject remember(TLCState state) {
        if (states.size() >= 10000) throw new IllegalStateException("Exploration reached its 10000-state retention limit. Reset the exploration.");
        String id = "state-" + states.size();
        states.put(id, state);
        JsonObject result = StateValues.state(id, state);
        result.add("invariants", invariants(state));
        result.addProperty("withinConstraints", tool.isInModel(state));
        return result;
    }

    private TLCState get(String id) {
        TLCState state = states.get(id);
        if (state == null) throw new IllegalArgumentException("Unknown or expired state. Start exploration again.");
        return state;
    }

    @Override public void close() throws IOException { workspace.close(); }

    private static final class ChoiceLimit extends RuntimeException { }
}
