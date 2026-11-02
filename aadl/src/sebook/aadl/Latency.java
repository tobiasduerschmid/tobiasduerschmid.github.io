package sebook.aadl;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.osate.aadl2.instance.SystemInstance;
import org.osate.analysis.flows.FlowLatencyAnalysisSwitch;
import org.osate.result.Diagnostic;
import org.osate.result.IntegerValue;
import org.osate.result.RealValue;
import org.osate.result.Result;
import org.osate.result.StringValue;
import org.osate.result.Value;

/** Preserves OSATE analysis evidence without interpreting completion as adequacy. */
final class Latency {
    private Latency() { }

    static Map<String, Object> run(SystemInstance root) {
        var nativeResult = new FlowLatencyAnalysisSwitch(root).invoke(root, null, true, true, true, true, false);
        var result = new LinkedHashMap<String, Object>();
        result.put("kind", "latency");
        result.put("status", "complete");
        result.put("assumptions", Map.of("asynchronousSystem", true, "majorFrameDelay", true, "worstCaseDeadline", true, "bestCaseEmptyQueue", true, "disableQueuingLatency", false));
        result.put("diagnostics", nativeResult.getDiagnostics().stream().map(Latency::diagnostic).toList());
        result.put("results", nativeResult.getResults().stream().map(Latency::flow).toList());
        return result;
    }

    private static Map<String, Object> flow(Result item) {
        var result = entry(item);
        var values = item.getValues();
        if (values.size() == 7 && values.get(1) instanceof RealValue) {
            result.put("minimumMs", ((RealValue) values.get(1)).getValue());
            result.put("maximumMs", ((RealValue) values.get(2)).getValue());
            result.put("minimumRequirementMs", ((RealValue) values.get(5)).getValue());
            result.put("maximumRequirementMs", ((RealValue) values.get(6)).getValue());
        }
        return result;
    }

    private static LinkedHashMap<String, Object> entry(Result item) {
        var result = new LinkedHashMap<String, Object>();
        result.put("elementId", Projection.id(item.getModelElement()));
        result.put("message", item.getMessage());
        result.put("resultType", item.getResultType().getLiteral());
        result.put("values", item.getValues().stream().map(Latency::value).toList());
        result.put("diagnostics", item.getDiagnostics().stream().map(Latency::diagnostic).toList());
        result.put("contributors", item.getSubResults().stream().map(Latency::entry).toList());
        return result;
    }

    private static Object value(Value item) {
        if (item instanceof RealValue value) return value.getValue();
        if (item instanceof IntegerValue value) return value.getValue();
        if (item instanceof StringValue value) return value.getValue();
        return Map.of("type", item.eClass().getName());
    }

    private static Map<String, Object> diagnostic(Diagnostic item) {
        var result = new LinkedHashMap<String, Object>();
        result.put("severity", item.getDiagnosticType().getLiteral().toLowerCase());
        result.put("message", item.getMessage());
        result.put("elementId", Projection.id(item.getModelElement()));
        return result;
    }
}
