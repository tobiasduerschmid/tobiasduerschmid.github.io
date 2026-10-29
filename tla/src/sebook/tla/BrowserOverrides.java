package sebook.tla;

import tlc2.module.TLCGetSet;
import tlc2.overrides.ITLCOverrides;
import tlc2.overrides.TLAPlusOperator;
import tlc2.value.impl.BoolValue;
import tlc2.value.impl.StringValue;
import tlc2.value.impl.Value;

/** Observes model-requested termination while preserving the upstream operator's behavior. */
public final class BrowserOverrides implements ITLCOverrides {
    static volatile boolean stopRequested;

    @Override public Class<?>[] get() { return new Class<?>[] { BrowserOverrides.class }; }

    @TLAPlusOperator(identifier = "TLCSet", module = "TLC", warn = false)
    public static Value set(Value key, Value value) {
        if (key instanceof StringValue && ((StringValue) key).val.toString().equals("exit")
                && value == BoolValue.ValTrue) stopRequested = true;
        return TLCGetSet.TLCSet(key, value);
    }
}
