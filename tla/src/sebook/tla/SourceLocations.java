package sebook.tla;

import com.google.gson.JsonObject;
import pcal.PCalLocation;
import pcal.Region;
import pcal.TLAtoPCalMapping;
import tla2sany.st.Location;
import java.util.HashMap;
import java.util.Map;

/** Applies the official translator's source mapping to trace and action locations. */
final class SourceLocations {
    private final Map<String, TLAtoPCalMapping> translations = new HashMap<>();

    void translated(String module, TLAtoPCalMapping mapping) { translations.put(module, mapping); }

    JsonObject encode(Location location) {
        JsonObject result = StateValues.location(location);
        String module = result.get("file").getAsString();
        TLAtoPCalMapping translation = translations.get(module);
        if (translation == null) return result;
        Region region = new Region(new PCalLocation(location.beginLine() - 1, location.beginColumn() - 1),
                new PCalLocation(location.endLine() - 1, location.endColumn()));
        Region source = translation.mapTLAtoPCalRegion(region, translation.algLine);
        if (source == null) {
            result.addProperty("generated", true);
            return result;
        }
        JsonObject original = new JsonObject();
        original.addProperty("file", module);
        original.addProperty("line", source.getBegin().getLine() + 1);
        original.addProperty("column", source.getBegin().getColumn() + 1);
        original.addProperty("endLine", source.getEnd().getLine() + 1);
        original.addProperty("endColumn", source.getEnd().getColumn() + 1);
        original.add("generatedLocation", result);
        return original;
    }
}
