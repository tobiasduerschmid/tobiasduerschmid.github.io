package sebook.javaeditor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.objectweb.asm.*;
import org.objectweb.asm.tree.*;

/** Instruments a disposable copy of the compiled learner classes, only for Debug. */
public final class Debug {
    private static final String HOOK = "sebook/javaeditor/Trace";

    public static Map<String,byte[]> prepare(Map<String,byte[]> classes, String[] sources) {
        Trace.reset();
        Map<String,byte[]> result = new HashMap<>();
        for (Map.Entry<String,byte[]> entry : classes.entrySet()) {
            ClassNode cls = new ClassNode();
            new ClassReader(entry.getValue()).accept(cls, 0);
            String relative = cls.name.substring(0, cls.name.lastIndexOf('/') + 1) + cls.sourceFile;
            String path = null;
            for (String source : sources) {
                if (source.equals(relative) || source.endsWith("/" + relative)) { path = source; break; }
                // Tutorials also allow a package declaration in an editable root file.
                if (source.equals(cls.sourceFile)) path = source;
            }
            if (path != null) {
                Trace.files.put(cls.name.replace('/', '.'), path);
                for (MethodNode method : cls.methods) instrument(method, path);
            }
            ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
            cls.accept(writer);
            result.put(entry.getKey(), writer.toByteArray());
        }
        return result;
    }

    public static void uncaught(Throwable error) { Trace.uncaught(error); }

    private static void instrument(MethodNode method, String path) {
        // Insert before the actual instruction, after labels and stack-map frames.
        // Leave the original operand stack and branch targets intact at each probe.
        AbstractInsnNode[] original = method.instructions.toArray();
        if (original.length == 0) return;
        // Place entry before the first label so a back edge to that label does
        // not assign a new identity to the same activation.
        method.instructions.insert(new MethodInsnNode(Opcodes.INVOKESTATIC, HOOK, "enter", "()V", false));
        Map<AbstractInsnNode,Integer> offsets = new HashMap<>();
        for (int i = 0; i < original.length; i++) offsets.put(original[i], i);
        // A typed handler starts with its exception on the operand stack.
        // Finally handlers also have that shape but do not handle the exception.
        java.util.Set<AbstractInsnNode> handlers = new java.util.HashSet<>();
        for (TryCatchBlockNode block : method.tryCatchBlocks) {
            if (block.type == null) continue;
            AbstractInsnNode first = block.handler;
            while (first != null && first.getOpcode() < 0) first = first.getNext();
            handlers.add(first);
        }
        int line = 0, site = -1;
        boolean boundary = false;
        for (int i = 0; i < original.length; i++) {
            AbstractInsnNode op = original[i];
            if (op instanceof LineNumberNode) {
                line = ((LineNumberNode) op).line;
                boundary = true;
            }
            if (op.getOpcode() < 0 || line <= 0) continue;
            if (boundary) {
                List<LocalVariableNode> live = new ArrayList<>();
                if (method.localVariables != null) for (LocalVariableNode var : method.localVariables) {
                    if (offsets.get(var.start) <= i && i < offsets.get(var.end) &&
                            !(var.index == 0 && method.name.equals("<init>"))) live.add(var);
                }
                String[] names = new String[live.size()];
                InsnList probe = new InsnList();
                site = Trace.sites.size();
                probe.add(new LdcInsnNode(site));
                probe.add(new LdcInsnNode(live.size()));
                probe.add(new TypeInsnNode(Opcodes.ANEWARRAY, "java/lang/Object"));
                for (int j = 0; j < live.size(); j++) {
                    LocalVariableNode var = live.get(j);
                    names[j] = var.name;
                    Type type = Type.getType(var.desc);
                    probe.add(new InsnNode(Opcodes.DUP));
                    probe.add(new LdcInsnNode(j));
                    probe.add(new VarInsnNode(type.getOpcode(Opcodes.ILOAD), var.index));
                    box(probe, type);
                    probe.add(new InsnNode(Opcodes.AASTORE));
                }
                probe.add(new MethodInsnNode(Opcodes.INVOKESTATIC, HOOK, "line", "(I[Ljava/lang/Object;)V", false));
                method.instructions.insertBefore(op, probe);
                Trace.sites.add(new Trace.Site(path, line, names));
                boundary = false;
            }
            if ((op.getOpcode() == Opcodes.ATHROW || handlers.contains(op)) && site >= 0) {
                InsnList probe = new InsnList();
                probe.add(new InsnNode(Opcodes.DUP));
                probe.add(new LdcInsnNode(site));
                probe.add(new MethodInsnNode(Opcodes.INVOKESTATIC, HOOK, handlers.contains(op) ? "caught" : "thrown", "(Ljava/lang/Throwable;I)V", false));
                method.instructions.insertBefore(op, probe);
            }
        }
    }

    private static void box(InsnList code, Type type) {
        String name;
        switch (type.getSort()) {
            case Type.BOOLEAN: name = "Boolean"; break;
            case Type.BYTE: name = "Byte"; break;
            case Type.SHORT: name = "Short"; break;
            case Type.CHAR: name = "Character"; break;
            case Type.INT: name = "Integer"; break;
            case Type.FLOAT: name = "Float"; break;
            case Type.LONG: name = "Long"; break;
            case Type.DOUBLE: name = "Double"; break;
            default: return;
        }
        String owner = "java/lang/" + name;
        code.add(new MethodInsnNode(Opcodes.INVOKESTATIC, owner, "valueOf", "(" + type.getDescriptor() + ")L" + owner + ";", false));
    }
}
