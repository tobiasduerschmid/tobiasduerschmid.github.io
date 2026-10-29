package sebook.tla;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import tla2sany.st.Location;
import tlc2.tool.TLCState;
import tlc2.value.IValue;
import tlc2.value.impl.*;

/** Serializes upstream values without coercing TLA sets, tuples, or model values to JSON values. */
final class StateValues {
    private StateValues() { }

    static JsonObject state(String id, TLCState state) {
        JsonObject result = new JsonObject();
        result.addProperty("id", id);
        JsonArray values = new JsonArray();
        state.getVals().forEach((name, value) -> {
            JsonObject item = value(value, 0);
            item.addProperty("name", name.toString());
            values.add(item);
        });
        result.add("values", values);
        return result;
    }

    static JsonObject value(IValue value, int depth) {
        JsonObject result = new JsonObject();
        result.addProperty("type", type(value));
        result.addProperty("text", value == null ? "<unassigned>" : value.toString());
        if (depth >= 12) {
            result.addProperty("childrenTruncated", true);
            return result;
        }
        JsonArray children = new JsonArray();
        if (value instanceof TupleValue) {
            Value[] elements = ((TupleValue) value).elems;
            for (int i = 0; i < Math.min(elements.length, 200); i++)
                children.add(named(Integer.toString(i + 1), elements[i], depth));
            if (elements.length > 200) result.addProperty("childrenTruncated", true);
        } else if (value instanceof SetEnumValue) {
            ValueVec elements = ((SetEnumValue) value).elems;
            for (int i = 0; i < Math.min(elements.size(), 200); i++)
                children.add(value(elements.elementAt(i), depth + 1));
            if (elements.size() > 200) result.addProperty("childrenTruncated", true);
        } else if (value instanceof RecordValue) {
            RecordValue record = (RecordValue) value;
            for (int i = 0; i < Math.min(record.values.length, 200); i++)
                children.add(named(record.names[i].toString(), record.values[i], depth));
            if (record.values.length > 200) result.addProperty("childrenTruncated", true);
        } else if (value instanceof FcnRcdValue) {
            FcnRcdValue function = (FcnRcdValue) value;
            for (int i = 0; i < Math.min(function.values.length, 200); i++) {
                IValue key = function.domain == null ? IntValue.gen(function.intv.low + i) : function.domain[i];
                JsonObject pair = named(key.toString(), function.values[i], depth);
                pair.add("key", value(key, depth + 1));
                children.add(pair);
            }
            if (function.values.length > 200) result.addProperty("childrenTruncated", true);
        }
        if (children.size() > 0) result.add("children", children);
        return result;
    }

    private static JsonObject named(String name, IValue value, int depth) {
        JsonObject result = value(value, depth + 1);
        result.addProperty("name", name);
        return result;
    }

    private static String type(IValue value) {
        if (value == null) return "unassigned";
        if (value instanceof IntValue) return "integer";
        if (value instanceof BoolValue) return "boolean";
        if (value instanceof StringValue) return "string";
        if (value instanceof ModelValue) return "model-value";
        if (value instanceof TupleValue) return "tuple";
        if (value instanceof RecordValue) return "record";
        if (value instanceof FcnRcdValue || value instanceof FcnLambdaValue) return "function";
        if (value instanceof SetEnumValue) return "set";
        return value instanceof Value ? ((Value) value).getKindString() : value.getClass().getSimpleName();
    }

    static JsonObject location(Location location) {
        JsonObject result = new JsonObject();
        result.addProperty("file", location.source() + ".tla");
        result.addProperty("line", location.beginLine());
        result.addProperty("column", location.beginColumn());
        result.addProperty("endLine", location.endLine());
        result.addProperty("endColumn", location.endColumn());
        return result;
    }
}
