package sebook.javaeditor;

import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.lang.ref.WeakReference;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/** Stack-frame and variable snapshots for instrumented code. Never calls learner toString(). */
public final class Trace {
    static final class Site {
        final String file;
        final int line;
        final String[] names;
        Site(String file, int line, String[] names) { this.file = file; this.line = line; this.names = names; }
    }
    static final List<Site> sites = new ArrayList<>();
    static final Map<String,String> files = new HashMap<>();
    private static int nextHandle;
    private static boolean capped;
    private static final java.util.concurrent.atomic.AtomicInteger nextCall = new java.util.concurrent.atomic.AtomicInteger();
    private static final ThreadLocal<List<Integer>> calls = new ThreadLocal<List<Integer>>() {
        protected List<Integer> initialValue() { return new ArrayList<>(); }
    };
    // Every entry probe reads the JVM stack once, including recursion and calls
    // from library code. A later entry at the same depth replaces the old activation.
    public static void enter() {
        int depth = 0;
        for (StackTraceElement frame : Thread.currentThread().getStackTrace()) {
            if (files.containsKey(frame.getClassName())) depth++;
        }
        List<Integer> ids = calls.get();
        while (ids.size() < depth) ids.add(0);
        if (depth > 0) ids.set(depth - 1, nextCall.incrementAndGet());
    }
    private static final Map<Integer,WeakReference<Object>> handles =
        new LinkedHashMap<Integer,WeakReference<Object>>() {
            protected boolean removeEldestEntry(Map.Entry<Integer,WeakReference<Object>> entry) { return size() > 2048; }
        };
    static void reset() { sites.clear(); files.clear(); handles.clear(); nextHandle = 0; capped = false; }

    private static synchronized int retain(Object value) {
        handles.put(++nextHandle, new WeakReference<>(value));
        return nextHandle;
    }

    public static String inspect(int handle) {
        WeakReference<Object> reference;
        synchronized (Trace.class) { reference = handles.get(handle); }
        Object value = reference == null ? null : reference.get();
        if (value == null) return "{}";
        return describe(value, true).toString();
    }
    private static native boolean event(String payload);

    public static void line(int id, Object[] values) { send(id, values, null, ""); }
    public static void thrown(Throwable exception, int id) { send(id, null, exception, "throw"); }
    public static void caught(Throwable exception, int id) { send(id, null, exception, "catch"); }
    static void uncaught(Throwable exception) { if (!capped) send(-1, null, exception, "uncaught"); }

    private static void send(int id, Object[] values, Throwable error, String phase) {
        if (id >= sites.size() || (id < 0 && error == null)) return;
        Site site = id < 0 ? null : sites.get(id);
        JsonObject snap = new JsonObject();
        JsonObject locals = new JsonObject();
        if (site != null && values != null) for (int i = 0; i < Math.min(site.names.length, values.length); i++)
            locals.add(site.names[i], describe(values[i], false));
        snap.add("locals", locals);
        snap.addProperty("thread", Thread.currentThread().getId());
        snap.addProperty("event", error == null ? "line" : "exception");
        if (error != null) {
            JsonObject exception = new JsonObject();
            exception.addProperty("type", error.getClass().getName());
            exception.addProperty("phase", phase);
            exception.addProperty("oid", System.identityHashCode(error));
            // A throw precedes handler selection, so its caught status is still unknown.
            if (!phase.equals("throw")) exception.addProperty("caught", phase.equals("catch"));
            exception.addProperty("message", phase.equals("uncaught") ? "Uncaught" : phase.equals("catch") ? "Caught" : "Thrown");
            snap.add("exception", exception);
        }
        JsonArray stack = new JsonArray();
        StackTraceElement[] trace = error != null && site == null ? error.getStackTrace() : Thread.currentThread().getStackTrace();
        for (int i = trace.length - 1; i >= 0; i--) {
            StackTraceElement frame = trace[i];
            String file = files.get(frame.getClassName());
            if (file == null) continue;
            JsonObject item = new JsonObject();
            List<Integer> ids = calls.get();
            if (stack.size() < ids.size()) item.addProperty("call_id", ids.get(stack.size()));
            item.addProperty("file", "/tutorial/" + file);
            item.addProperty("function", frame.getClassName() + "." + frame.getMethodName());
            item.addProperty("line", frame.getLineNumber());
            stack.add(item);
        }
        if (stack.size() == 0) return;
        JsonObject top = stack.get(stack.size() - 1).getAsJsonObject();
        // CheerpJ may report incomplete line tables. Our probe is tied to the ECJ line table.
        if (site != null) {
            top.addProperty("file", "/tutorial/" + site.file);
            top.addProperty("line", site.line);
        }
        snap.add("stack", stack);
        if (!event(snap.toString())) {
            capped = true;
            throw new IllegalStateException("Java debugger history limit reached.");
        }
    }

    private static JsonObject describe(Object value, boolean readMembers) {
        JsonObject result = new JsonObject();
        Class<?> type = value == null ? null : value.getClass();
        result.addProperty("type", type == null ? "null" : type.getTypeName());
        if (type == null || type == String.class || type == Character.class || type == Boolean.class ||
                type == Integer.class || type == Long.class || type == Double.class || type == Float.class ||
                type == Byte.class || type == Short.class) {
            String repr = String.valueOf(value);
            result.addProperty("kind", "primitive");
            result.addProperty("repr", repr.length() <= 200 ? repr : repr.substring(0,200) + "…");
            return result;
        }
        result.addProperty("oid", System.identityHashCode(value));
        if (!readMembers && (type.isArray() || files.containsKey(type.getName()))) {
            result.addProperty("handle", retain(value));
        }
        if (type.isArray()) {
            int size = Array.getLength(value);
            result.addProperty("kind", "collection");
            result.addProperty("repr", type.getComponentType().getSimpleName() + "[" + size + "]");
            result.addProperty("len", size);
            JsonArray items = new JsonArray();
            if (readMembers) for (int i = 0; i < Math.min(size, 16); i++) items.add(describe(Array.get(value, i), false));
            result.add("children", items);
            result.addProperty("truncated", items.size() < size);
        } else {
            result.addProperty("kind", "object");
            result.addProperty("repr", type.getSimpleName() + "@" + Integer.toHexString(System.identityHashCode(value)));
            JsonObject fields = new JsonObject();
            if (readMembers) for (Class<?> cls = type; cls != null && files.containsKey(cls.getName()); cls = cls.getSuperclass()) {
                for (Field field : cls.getDeclaredFields()) {
                    if (fields.size() >= 16 || Modifier.isStatic(field.getModifiers()) || field.isSynthetic() || fields.has(field.getName())) continue;
                    try {
                        field.setAccessible(true);
                        fields.add(field.getName(), describe(field.get(value), false));
                    } catch (IllegalAccessException | SecurityException inaccessible) { /* inaccessible in this VM */ }
                }
            }
            result.add("attrs", fields);
        }
        return result;
    }
}
