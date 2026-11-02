package sebook.aadl;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.osate.aadl2.instance.SystemInstance;

/** Serial submissions share language services, but never mutable model resources. */
public final class Bridge {
    private static final Gson JSON = new GsonBuilder().serializeNulls().create();

    private Bridge() { }

    /** Performs language-service startup before the host begins its analysis deadline. */
    public static String initialize() {
        Engine.initialize();
        return "OSATE 2.21.0-SNAPSHOT (b8308b7); AADL language server 0.3.0 (895e0b9)";
    }

    public static synchronized String execute(String input) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("version", 1);
        List<Map<String, Object>> diagnostics = new ArrayList<>();
        result.put("diagnostics", diagnostics);
        result.put("analyses", List.of());
        try {
            JsonObject request = JsonParser.parseString(input).getAsJsonObject();
            try (Workspace workspace = new Workspace(request)) {
                SystemInstance instance = workspace.instantiate(diagnostics);
                if (instance == null) {
                    result.put("status", "invalid");
                } else {
                    result.put("model", Projection.model(instance));
                    if (workspace.analyze()) result.put("analyses", List.of(Latency.run(instance)));
                    result.put("status", "complete");
                }
            }
        } catch (Exception | LinkageError error) {
            result.put("status", "error");
            result.remove("model");
            result.put("analyses", List.of());
            diagnostics.add(Map.of("severity", "error", "message", error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage())));
            error.printStackTrace(java.lang.System.err);
        }
        return JSON.toJson(result);
    }

    public static void main(String[] args) throws IOException {
        var output = java.lang.System.out;
        java.lang.System.setOut(java.lang.System.err);
        var input = new BufferedReader(new InputStreamReader(java.lang.System.in, StandardCharsets.UTF_8));
        String line;
        while ((line = input.readLine()) != null) {
            if (!line.isBlank()) output.println(execute(line));
        }
    }
}
