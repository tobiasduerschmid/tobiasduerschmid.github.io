#ifndef SEBOOK_OBJECT_REFERENCE_CPP_RUNTIME_HPP
#define SEBOOK_OBJECT_REFERENCE_CPP_RUNTIME_HPP
#include <iostream>
#include <string>
#include <sstream>
#include <functional>
#include <vector>
#include <map>
#include <set>
#include <type_traits>
#include <cstdio>
#include <cstdlib>
#include <memory>

// Observers never evaluate user expressions and never dereference pointer values.
namespace __ort {
inline std::string quote(const std::string& value) {
  std::string result = "\"";
  for (unsigned char ch : value) {
    if (ch == '"' || ch == '\\') { result += '\\'; result += ch; }
    else if (ch < 32) { char escaped[7]; std::snprintf(escaped, sizeof escaped, "\\u%04x", ch); result += escaped; }
    else result += ch;
  }
  return result + '"';
}
inline void emit(const std::string& record) { std::fprintf(stderr, "__ORT__%s\n", record.c_str()); std::fflush(stderr); }
[[noreturn]] inline void stop(const std::string& reason) {
  emit("{\"end\":true,\"truncated\":true,\"error\":" + quote(reason) + "}"); std::_Exit(0);
}
[[noreturn]] inline void unsupported(const std::string& reason) {
  emit("{\"end\":true,\"truncated\":false,\"error\":" + quote(reason) + "}"); std::_Exit(0);
}
template<class T> const void* typeIdentity() {
  static const char identity = 0;
  return &identity;
}
class Output : public std::streambuf {
 public:
  std::string text;
 protected:
  int_type overflow(int_type ch) override {
    if (traits_type::eq_int_type(ch, traits_type::eof())) return traits_type::not_eof(ch);
    if (text.size() >= 16384) stop("Program output exceeds the 16 KiB lab limit.");
    text += traits_type::to_char_type(ch); return ch;
  }
};
struct Object {
  const void* address;
  const void* typeIdentity;
  std::string id, type;
  std::function<std::string()> read;
  bool live = true;
};
struct Binding {
  std::string name, semantics, target;
  std::function<const void*()> pointer;
  bool live = true;
  const void* pointeeType = nullptr;
};
struct Scope { std::string id, name; std::vector<size_t> bindings; };
struct Runtime {
  Output output;
  std::streambuf* coutBuffer = std::cout.rdbuf(&output);
  std::streambuf* cerrBuffer = std::cerr.rdbuf(&output);
  std::vector<Object> objects;
  std::vector<Binding> bindings;
  std::vector<Scope> scopes;
  std::map<const void*, size_t> liveObjects;
  std::map<const void*, std::string> expiredObjects;
  std::map<std::pair<const void*, const void*>, std::string> unknownObjects;
  std::set<const void*> reusedAddresses;
  unsigned steps = 0, ticks = 0, frames = 0;
  ~Runtime() { std::cout.rdbuf(coutBuffer); std::cerr.rdbuf(cerrBuffer); }
};
inline Runtime& runtime() { static Runtime value; return value; }
inline void tick() { if (++runtime().ticks > 1000) stop("Execution exceeds the 1,000-operation lab limit."); }
inline std::string pointerTarget(const void* address, const void* pointeeType, std::map<std::string, std::string>& special) {
  auto& state = runtime();
  if (!address) { special["cpp-null"] = "Null pointer; no pointee."; return "cpp-null"; }
  if (state.reusedAddresses.count(address)) {
    const std::string id = "cpp-ambiguous-" + state.expiredObjects[address];
    special[id] = "Storage address was reused; pointer lifetime provenance is ambiguous."; return id;
  }
  auto live = state.liveObjects.find(address);
  if (live != state.liveObjects.end() && state.objects[live->second].typeIdentity == pointeeType) {
    return state.objects[live->second].id;
  }
  auto expired = state.expiredObjects.find(address);
  if (expired != state.expiredObjects.end()) {
    for (const auto& object : state.objects) {
      if (object.id == expired->second && object.typeIdentity == pointeeType) {
        special[expired->second] = "Dangling pointer: the observed storage lifetime has ended."; return expired->second;
      }
    }
  }
  const auto key = std::make_pair(address, pointeeType);
  if (!state.unknownObjects.count(key)) state.unknownObjects[key] = "cpp-unobserved" + std::to_string(state.unknownObjects.size() + 1);
  const std::string id = state.unknownObjects[key];
  special[id] = "Pointer target is outside observed live storage; it is not dereferenced.";
  return id;
}
inline void snapshot(int line, const char* event) {
  auto& state = runtime(); tick();
  if (++state.steps > 240) stop("Trace exceeds the 240-state lab limit.");
  std::map<std::string, std::string> special;
  std::string json = "{\"step\":{\"event\":" + quote(event) + ",\"line\":" + std::to_string(line) + ",\"visualizedLine\":" + std::to_string(line) + ",\"scopes\":[";
  bool firstScope = true;
  for (const auto& scope : state.scopes) {
    if (!firstScope) json += ','; firstScope = false;
    json += "{\"id\":" + quote(scope.id) + ",\"name\":" + quote(scope.name) + ",\"bindings\":[";
    bool firstBinding = true;
    for (size_t index : scope.bindings) {
      const auto& binding = state.bindings[index];
      if (!binding.live) continue;
      if (!firstBinding) json += ','; firstBinding = false;
      const std::string target = binding.pointer ? pointerTarget(binding.pointer(), binding.pointeeType, special) : binding.target;
      json += "{\"name\":" + quote(binding.name) + ",\"target\":" + quote(target) + ",\"semantics\":" + quote(binding.semantics) + "}";
    }
    json += "]}";
  }
  json += "],\"objects\":[";
  bool firstObject = true;
  for (const auto& object : state.objects) {
    if (!object.live) continue;
    if (!firstObject) json += ','; firstObject = false;
    json += "{\"id\":" + quote(object.id) + ",\"type\":" + quote(object.type) + ",\"value\":" + quote(object.read()) + "}";
  }
  for (const auto& item : special) {
    if (!firstObject) json += ','; firstObject = false;
    json += "{\"id\":" + quote(item.first) + ",\"type\":\"pointer target\",\"value\":" + quote(item.first == "cpp-null" ? "nullptr" : "unavailable") + ",\"note\":" + quote(item.second) + "}";
  }
  json += "],\"output\":" + quote(state.output.text) + "}}";
  emit(json);
}
struct Frame {
  explicit Frame(const char* name) {
    auto& state = runtime();
    if (state.scopes.size() >= 24) stop("Call depth exceeds the 24-frame lab limit.");
    state.scopes.push_back({"cpp-s" + std::to_string(++state.frames), name, {}});
    if (state.scopes.size() == 1) snapshot(0, "initial");
  }
  ~Frame() {
    auto& state = runtime(); state.scopes.pop_back();
    if (state.scopes.empty()) emit("{\"end\":true,\"truncated\":false,\"output\":" + quote(state.output.text) + "}");
  }
};
// Scope-exit observations happen in caller code, after Watch destructors removed expired values.
struct Block {
  explicit Block(int line) {
    auto& state = runtime();
    if (state.scopes.size() >= 24) stop("Scope depth exceeds the 24-scope lab limit.");
    const std::string parent = state.scopes.back().name;
    const std::string name = parent.substr(0, parent.find(" · block")) + " · block at line " + std::to_string(line);
    state.scopes.push_back({"cpp-s" + std::to_string(++state.frames), name, {}});
  }
  ~Block() { runtime().scopes.pop_back(); }
};
template<class T> std::string display(const T& value) {
  if constexpr (std::is_same_v<std::remove_cv_t<T>, std::string>) {
    if (value.size() > 4096) stop("A string exceeds the 4,096-byte lab limit.");
    return quote(value);
  } else if constexpr (std::is_same_v<std::remove_cv_t<T>, bool>) return value ? "true" : "false";
  else { std::ostringstream out; out.precision(17); out << value; return out.str(); }
}
template<class Declared> struct Watch {
  using T = std::remove_reference_t<Declared>;
  size_t bindingIndex, objectIndex = 0;
  bool ownsObject = false;
  Watch(const char* name, T& value, const char* semantics, const char* type) {
    static_assert(std::is_arithmetic_v<T> || std::is_same_v<std::remove_cv_t<T>, std::string> || std::is_pointer_v<T>, "C++ lab supports only scalar, string and pointer values");
    static_assert(!(std::is_pointer_v<T> && std::is_reference_v<Declared>), "References to pointers are not supported in this lab");
    using Pointee = std::remove_cv_t<std::remove_pointer_t<T>>;
    static_assert(!std::is_pointer_v<T> || std::is_arithmetic_v<Pointee> || std::is_same_v<Pointee, std::string>, "Pointers must have one level of indirection to a scalar or std::string in this lab");
    auto& state = runtime();
    if (state.bindings.size() >= 192 || state.objects.size() >= 128) stop("Trace exceeds the 192-binding or 128-lifetime lab limit.");
    Binding binding{name, semantics, "", {}};
    if constexpr (std::is_pointer_v<T>) {
      binding.semantics = "object-reference";
      binding.pointeeType = typeIdentity<Pointee>();
      binding.pointer = [&value]() -> const void* { return value; };
    } else {
      const void* address = std::addressof(value);
      const void* actualType = typeIdentity<std::remove_cv_t<T>>();
      auto existing = state.liveObjects.find(address);
      if constexpr (std::is_reference_v<Declared>) {
        if (existing == state.liveObjects.end() || state.objects[existing->second].typeIdentity != actualType) {
          unsupported("Reference '" + std::string(name) + "' must alias an already observed whole object of the same type; subobjects and untracked temporaries are unsupported.");
        }
      }
      if (existing != state.liveObjects.end() && state.objects[existing->second].typeIdentity != actualType) {
        unsupported("Overlapping storage of different types cannot be observed in this lab.");
      }
      if (existing == state.liveObjects.end()) {
        if (state.expiredObjects.count(address)) state.reusedAddresses.insert(address);
        objectIndex = state.objects.size(); ownsObject = true;
        state.objects.push_back({address, actualType, "cpp-o" + std::to_string(objectIndex + 1), type, [&value] { return display(value); }});
        state.liveObjects[address] = objectIndex;
      } else objectIndex = existing->second;
      binding.target = state.objects[objectIndex].id;
    }
    bindingIndex = state.bindings.size(); state.bindings.push_back(binding);
    state.scopes.back().bindings.push_back(bindingIndex);
  }
  ~Watch() {
    auto& state = runtime(); state.bindings[bindingIndex].live = false;
    if (ownsObject) {
      auto& object = state.objects[objectIndex]; object.live = false; object.read = {};
      state.liveObjects.erase(object.address); state.expiredObjects[object.address] = object.id;
    }
  }
};
}
#endif
