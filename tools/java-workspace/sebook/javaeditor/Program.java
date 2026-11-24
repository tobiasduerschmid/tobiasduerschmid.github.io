package sebook.javaeditor;

import com.google.gson.*;
import java.io.*;
import java.lang.reflect.*;
import java.security.Permission;
import java.util.*;

/** Each invocation gets new application classes and independent standard streams. */
final class Program {
    private static final int OUTPUT_LIMIT = 128 * 1024;

    private static final class BoundedOutput extends OutputStream {
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        boolean truncated;
        @Override public void write(int value) {
            if (bytes.size() < OUTPUT_LIMIT) bytes.write(value);
            else truncated = true;
        }
        @Override public void write(byte[] source, int offset, int len) {
            int count = Math.min(len, OUTPUT_LIMIT - bytes.size());
            bytes.write(source, offset, count);
            if (count < len) truncated = true;
        }
        String text() throws IOException {
            return bytes.toString("UTF-8") + (truncated ? "\n[Further output omitted]\n" : "");
        }
    }

    private static final class Exit extends SecurityException {
        final int code;
        Exit(int code) { this.code = code; }
    }

    static void trapExit() {
        // The runtime frame is the browser isolation boundary. This hook preserves the
        // workspace when ordinary programs or their test harnesses call System.exit.
        System.setSecurityManager(new SecurityManager() {
            @Override public void checkExit(int status) { throw new Exit(status); }
            @Override public void checkPermission(Permission permission) {
                if ("setSecurityManager".equals(permission.getName())) throw new SecurityException("Cannot replace the tutorial exit handler.");
            }
        });
    }

    static JsonObject run(List<String> names, Map<String,byte[]> classes, String[] args, boolean debug, boolean assertions) throws Exception {
        ClassLoader parent = debug ? new ClassLoader(null) {
            @Override protected Class<?> findClass(String name) throws ClassNotFoundException {
                if ("sebook.javaeditor.Trace".equals(name)) return Program.class.getClassLoader().loadClass(name);
                throw new ClassNotFoundException(name);
            }
        } : null;
        BoundedOutput stdout = new BoundedOutput(), stderr = new BoundedOutput();
        PrintStream previousOut = System.out, previousErr = System.err;
        InputStream previousIn = System.in;
        Properties previousProperties = System.getProperties();
        Thread thread = Thread.currentThread();
        ClassLoader previousContext = thread.getContextClassLoader();
        int exit = 0;
        boolean resetRuntime = false;
        ClassLoader loader = new ClassLoader(parent) {
            @Override protected Class<?> findClass(String name) throws ClassNotFoundException {
                byte[] bytes = classes.get(name);
                if (bytes == null) throw new ClassNotFoundException(name);
                return defineClass(name, bytes, 0, bytes.length);
            }
        };
        try (PrintStream out = new PrintStream(stdout, true, "UTF-8");
             PrintStream err = new PrintStream(stderr, true, "UTF-8")) {
            loader.setDefaultAssertionStatus(assertions);
            System.setOut(out); System.setErr(err); System.setIn(new ByteArrayInputStream(new byte[0]));
            System.setProperties((Properties) previousProperties.clone());
            thread.setContextClassLoader(loader);
            try {
                Method main = mainMethod(loader, names);
                if (main == null) throw new IllegalArgumentException("No public static void main(String[] args) found in the selected Java file.");
                main.setAccessible(true);
                main.invoke(null, (Object) args);
                resetRuntime = finishThreads(thread, loader, false);
            } catch (Throwable failure) {
                Throwable cause = failure instanceof InvocationTargetException ? failure.getCause() : failure;
                if (cause instanceof Exit) {
                    exit = ((Exit) cause).code;
                    resetRuntime = finishThreads(thread, loader, true);
                }
                else {
                    exit = 1;
                    if (debug) Debug.uncaught(cause);
                    cause.printStackTrace(err);
                    resetRuntime = finishThreads(thread, loader, false);
                }
            }
        } finally {
            System.setProperties(previousProperties);
            thread.setContextClassLoader(previousContext);
            System.setIn(previousIn); System.setOut(previousOut); System.setErr(previousErr);
        }
        JsonObject result = new JsonObject();
        result.addProperty("exitCode", exit);
        if (resetRuntime) result.addProperty("resetRuntime", true);
        result.addProperty("stdout", stdout.text());
        result.addProperty("stderr", stderr.text());
        return result;
    }

    // A normal JVM keeps running until its non-daemon application threads finish.
    // If a daemon survives, discard this worker before another learner program runs.
    private static boolean finishThreads(Thread main, ClassLoader loader, boolean exiting) throws InterruptedException {
        ThreadGroup group = main.getThreadGroup();
        while (true) {
            int size = group.activeCount() + 4;
            Thread[] candidates;
            int count;
            do {
                candidates = new Thread[size];
                count = group.enumerate(candidates);
                size *= 2;
            } while (count == candidates.length);
            Thread join = null;
            boolean live = false;
            for (int i = 0; i < count; i++) {
                Thread child = candidates[i];
                if (child == main || child.getContextClassLoader() != loader || !child.isAlive()) continue;
                live = true;
                if (!child.isDaemon()) join = child;
            }
            if (join == null || exiting) return live;
            join.join();
        }
    }

    private static Method mainMethod(ClassLoader loader, List<String> names) throws ClassNotFoundException {
        for (String name : names) {
            try {
                Method main = loader.loadClass(name).getMethod("main", String[].class);
                if (Modifier.isStatic(main.getModifiers()) && main.getReturnType() == void.class) return main;
            } catch (NoSuchMethodException missing) { /* Continue through classes emitted for this source. */ }
        }
        return null;
    }
}
