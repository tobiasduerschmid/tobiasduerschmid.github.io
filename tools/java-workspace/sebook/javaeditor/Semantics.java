package sebook.javaeditor;

import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.eclipse.jdt.internal.compiler.ASTVisitor;
import org.eclipse.jdt.internal.compiler.ast.*;
import org.eclipse.jdt.internal.compiler.lookup.*;

/** Binding identities and source ranges from the same ECJ version as Run. */
public final class Semantics extends ASTVisitor {
    private final JsonArray symbols = new JsonArray();
    private String file;
    private String text;

    void collect(CompilationUnitDeclaration unit, String filename, String source) {
        file = filename;
        text = source;
        unit.traverse(this, unit.scope, false);
    }

    JsonArray bindings() { return symbols; }

    private static String type(TypeBinding binding) {
        return binding == null ? "" : new String(binding.readableName());
    }

    private JsonObject add(Binding binding, char[] token, int start, boolean declaration, Scope scope) {
        if (binding == null || !binding.isValidBinding() || token == null || token.length == 0) return null;
        String name = new String(token);
        // Compiler-generated nodes can share their enclosing declaration's range.
        if (!text.startsWith(name, start)) return null;
        JsonObject symbol = new JsonObject();
        if (binding instanceof MethodBinding) {
            MethodBinding method = (MethodBinding) binding;
            symbol.addProperty("kind", "method");
            if (declaration) member(symbol, method.declaringClass, method.modifiers);
            symbol.addProperty("owner", type(method.declaringClass.erasure()));
            symbol.addProperty("type", type(method.returnType));
            JsonArray parameters = new JsonArray();
            for (TypeBinding p : method.parameters) parameters.add(type(p));
            symbol.add("parameters", parameters);
            binding = method.original();
            if (declaration && !method.isConstructor() && !method.isPrivate() && !method.isStatic()) {
                symbol.add("overrides", overridden(method, scope));
            }
            if (method.isConstructor()) symbol.addProperty("constructor", true);
        } else if (binding instanceof VariableBinding) {
            VariableBinding variable = (VariableBinding) binding;
            symbol.addProperty("kind", binding instanceof FieldBinding ? "field" : "variable");
            symbol.addProperty("type", type(variable.type));
            if (binding instanceof FieldBinding) {
                FieldBinding field = (FieldBinding) binding;
                if (field.declaringClass == null) return null; // array.length
                if (declaration) member(symbol, field.declaringClass, field.modifiers);
                symbol.addProperty("owner", type(field.declaringClass.erasure()));
                binding = field.original();
            }
        } else if (binding instanceof TypeBinding) {
            TypeBinding t = ((TypeBinding) binding).leafComponentType().erasure();
            if (t.isBaseType()) return null;
            symbol.addProperty("kind", "type");
            symbol.addProperty("type", type(t));
            binding = t;
        } else return null;
        char[] key = binding.computeUniqueKey();
        if (key == null) return null;
        symbol.addProperty("key", new String(key));
        symbol.addProperty("name", name);
        symbol.addProperty("file", file);
        symbol.addProperty("start", start);
        symbol.addProperty("end", start + token.length);
        symbol.addProperty("declaration", declaration);
        MethodScope caller = scope == null ? null : scope.methodScope();
        if (caller != null && caller.referenceMethodBinding() != null)
            symbol.addProperty("caller", new String(caller.referenceMethodBinding().original().computeUniqueKey()));
        symbols.add(symbol);
        return symbol;
    }

    private static void member(JsonObject symbol, ReferenceBinding owner, int modifiers) {
        symbol.addProperty("access", java.lang.reflect.Modifier.isPrivate(modifiers) ? "private" :
            java.lang.reflect.Modifier.isPublic(modifiers) ? "public" :
            java.lang.reflect.Modifier.isProtected(modifiers) ? "protected" : "package");
        symbol.addProperty("static", java.lang.reflect.Modifier.isStatic(modifiers));
        symbol.addProperty("package", new String(owner.qualifiedPackageName()));
        symbol.addProperty("nest", type(owner.outermostEnclosingType().erasure()));
    }

    private static JsonArray overridden(MethodBinding method, Scope scope) {
        JsonArray result = new JsonArray();
        ArrayDeque<ReferenceBinding> todo = new ArrayDeque<>();
        Set<ReferenceBinding> visited = new HashSet<>();
        todo.add(method.declaringClass);
        while (!todo.isEmpty()) {
            ReferenceBinding type = todo.remove();
            if (!visited.add(type)) continue;
            if (type != method.declaringClass) {
                for (MethodBinding base : type.getMethods(method.selector)) {
                    if (MethodVerifier.doesMethodOverride(method, base, scope.environment()))
                        result.add(new String(base.original().computeUniqueKey()));
                }
            }
            if (type.superclass() != null) todo.add(type.superclass());
            if (type.superInterfaces() != null) todo.addAll(Arrays.asList(type.superInterfaces()));
        }
        return result;
    }

    private boolean typeDecl(TypeDeclaration node, Scope scope) {
        JsonObject symbol = add(node.binding, node.name, node.sourceStart, true, scope);
        if (symbol != null) {
            ReferenceBinding owner = node.binding;
            member(symbol, owner, owner.modifiers);
            symbol.addProperty("scopeStart", node.declarationSourceStart);
            symbol.addProperty("scopeEnd", node.declarationSourceEnd + 1);
            JsonArray parents = new JsonArray();
            if (owner.superclass() != null) parents.add(type(owner.superclass().erasure()));
            if (owner.superInterfaces() != null) for (ReferenceBinding parent : owner.superInterfaces())
                parents.add(type(parent.erasure()));
            symbol.add("parents", parents);
        }
        return true;
    }
    @Override public boolean visit(TypeDeclaration n, CompilationUnitScope s) { return typeDecl(n, s); }
    @Override public boolean visit(TypeDeclaration n, ClassScope s) { return typeDecl(n, s); }
    @Override public boolean visit(TypeDeclaration n, BlockScope s) { return typeDecl(n, s); }
    @Override public boolean visit(MethodDeclaration n, ClassScope s) {
        add(n.binding, n.selector, n.sourceStart, true, s); return true;
    }
    @Override public boolean visit(ConstructorDeclaration n, ClassScope s) {
        if (!n.isDefaultConstructor()) add(n.binding, n.selector, n.sourceStart, true, s);
        return true;
    }
    @Override public boolean visit(FieldDeclaration n, MethodScope s) {
        add(n.binding, n.name, n.sourceStart, true, s); return true;
    }
    @Override public boolean visit(LocalDeclaration n, BlockScope s) {
        add(n.binding, n.name, n.sourceStart, true, s); return true;
    }
    @Override public boolean visit(Argument n, BlockScope s) {
        add(n.binding, n.name, n.sourceStart, true, s); return true;
    }
    @Override public boolean visit(MessageSend n, BlockScope s) {
        add(n.binding, n.selector, n.nameSourceStart(), false, s); return true;
    }
    @Override public boolean visit(ReferenceExpression n, BlockScope s) {
        add(n.getMethodBinding(), n.selector, n.nameSourceStart, false, s); return true;
    }
    private boolean field(FieldReference n, Scope s) {
        add(n.binding, n.token, (int)(n.nameSourcePosition >>> 32), false, s); return true;
    }
    @Override public boolean visit(FieldReference n, BlockScope s) { return field(n,s); }
    @Override public boolean visit(FieldReference n, ClassScope s) { return field(n,s); }
    private boolean single(SingleNameReference n, Scope s) {
        add(n.binding, n.token, n.sourceStart, false, s); return true;
    }
    @Override public boolean visit(SingleNameReference n, BlockScope s) { return single(n,s); }
    @Override public boolean visit(SingleNameReference n, ClassScope s) { return single(n,s); }
    private boolean qualified(QualifiedNameReference n, Scope s) {
        int at = Math.max(0, n.indexOfFirstFieldBinding - 1);
        if (at < n.tokens.length) add(n.binding, n.tokens[at], (int)(n.sourcePositions[at] >>> 32), false, s);
        if (n.otherBindings != null) for (FieldBinding next : n.otherBindings) {
            if (++at < n.tokens.length) add(next, n.tokens[at], (int)(n.sourcePositions[at] >>> 32), false, s);
        }
        return true;
    }
    @Override public boolean visit(QualifiedNameReference n, BlockScope s) { return qualified(n,s); }
    @Override public boolean visit(QualifiedNameReference n, ClassScope s) { return qualified(n,s); }

    private int typeStart(TypeReference n) {
        int start = n.sourceStart;
        if (n instanceof QualifiedTypeReference) {
            long[] positions = ((QualifiedTypeReference)n).sourcePositions;
            start = (int)(positions[positions.length - 1] >>> 32);
        }
        return start;
    }
    private boolean typeRef(TypeReference n, Scope s) {
        add(n.resolvedType, n.getLastToken(), typeStart(n), false, s); return true;
    }
    private boolean construct(AllocationExpression n, BlockScope s) {
        if (n.type != null) add(n.binding, n.type.getLastToken(), typeStart(n.type), false, s);
        return true;
    }
    @Override public boolean visit(AllocationExpression n, BlockScope s) { return construct(n,s); }
    @Override public boolean visit(QualifiedAllocationExpression n, BlockScope s) { return construct(n,s);
    }
    @Override public boolean visit(SingleTypeReference n, BlockScope s) { return typeRef(n,s); }
    @Override public boolean visit(SingleTypeReference n, ClassScope s) { return typeRef(n,s); }
    @Override public boolean visit(QualifiedTypeReference n, BlockScope s) { return typeRef(n,s); }
    @Override public boolean visit(QualifiedTypeReference n, ClassScope s) { return typeRef(n,s); }
    @Override public boolean visit(ArrayTypeReference n, BlockScope s) { return typeRef(n,s); }
    @Override public boolean visit(ArrayTypeReference n, ClassScope s) { return typeRef(n,s); }
    @Override public boolean visit(ArrayQualifiedTypeReference n, BlockScope s) { return typeRef(n,s); }
    @Override public boolean visit(ArrayQualifiedTypeReference n, ClassScope s) { return typeRef(n,s); }
    @Override public boolean visit(ParameterizedSingleTypeReference n, BlockScope s) { return typeRef(n,s); }
    @Override public boolean visit(ParameterizedSingleTypeReference n, ClassScope s) { return typeRef(n,s); }
    @Override public boolean visit(ParameterizedQualifiedTypeReference n, BlockScope s) { return typeRef(n,s); }
    @Override public boolean visit(ParameterizedQualifiedTypeReference n, ClassScope s) { return typeRef(n,s); }
}
