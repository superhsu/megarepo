use crate::rustc_internal::Opaque;
use crate::stable_mir::{self, ty::Ty};

#[derive(Clone, Debug)]
pub struct Body {
    pub blocks: Vec<BasicBlock>,
    pub locals: Vec<Ty>,
}

#[derive(Clone, Debug)]
pub struct BasicBlock {
    pub statements: Vec<Statement>,
    pub terminator: Terminator,
}

#[derive(Clone, Debug)]
pub enum Terminator {
    Goto {
        target: usize,
    },
    SwitchInt {
        discr: Operand,
        targets: Vec<SwitchTarget>,
        otherwise: usize,
    },
    Resume,
    Abort,
    Return,
    Unreachable,
    Drop {
        place: Place,
        target: usize,
        unwind: UnwindAction,
    },
    Call {
        func: Operand,
        args: Vec<Operand>,
        destination: Place,
        target: Option<usize>,
        unwind: UnwindAction,
    },
    Assert {
        cond: Operand,
        expected: bool,
        msg: AssertMessage,
        target: usize,
        unwind: UnwindAction,
    },
    GeneratorDrop,
    InlineAsm {
        template: String,
        operands: Vec<InlineAsmOperand>,
        options: String,
        line_spans: String,
        destination: Option<usize>,
        unwind: UnwindAction,
    },
}

#[derive(Clone, Debug)]
pub struct InlineAsmOperand {
    pub in_value: Option<Operand>,
    pub out_place: Option<Place>,
    // This field has a raw debug representation of MIR's InlineAsmOperand.
    // For now we care about place/operand + the rest in a debug format.
    pub raw_rpr: String,
}

#[derive(Clone, Debug)]
pub enum UnwindAction {
    Continue,
    Unreachable,
    Terminate,
    Cleanup(usize),
}

#[derive(Clone, Debug)]
pub enum AssertMessage {
    BoundsCheck { len: Operand, index: Operand },
    Overflow(BinOp, Operand, Operand),
    OverflowNeg(Operand),
    DivisionByZero(Operand),
    RemainderByZero(Operand),
    ResumedAfterReturn(GeneratorKind),
    ResumedAfterPanic(GeneratorKind),
    MisalignedPointerDereference { required: Operand, found: Operand },
}

#[derive(Clone, Debug)]
pub enum BinOp {
    Add,
    AddUnchecked,
    Sub,
    SubUnchecked,
    Mul,
    MulUnchecked,
    Div,
    Rem,
    BitXor,
    BitAnd,
    BitOr,
    Shl,
    ShlUnchecked,
    Shr,
    ShrUnchecked,
    Eq,
    Lt,
    Le,
    Ne,
    Ge,
    Gt,
    Offset,
}

#[derive(Clone, Debug)]
pub enum UnOp {
    Not,
    Neg,
}

#[derive(Clone, Debug)]
pub enum GeneratorKind {
    Async(AsyncGeneratorKind),
    Gen,
}

#[derive(Clone, Debug)]
pub enum AsyncGeneratorKind {
    Block,
    Closure,
    Fn,
}

#[derive(Clone, Debug)]
pub enum Statement {
    Assign(Place, Rvalue),
    Nop,
}

type Region = Opaque;

// FIXME this is incomplete
#[derive(Clone, Debug)]
pub enum Rvalue {
    /// Creates a pointer with the indicated mutability to the place.
    ///
    /// This is generated by pointer casts like `&v as *const _` or raw address of expressions like
    /// `&raw v` or `addr_of!(v)`.
    AddressOf(Mutability, Place),

    /// * `Offset` has the same semantics as [`offset`](pointer::offset), except that the second
    ///   parameter may be a `usize` as well.
    /// * The comparison operations accept `bool`s, `char`s, signed or unsigned integers, floats,
    ///   raw pointers, or function pointers and return a `bool`. The types of the operands must be
    ///   matching, up to the usual caveat of the lifetimes in function pointers.
    /// * Left and right shift operations accept signed or unsigned integers not necessarily of the
    ///   same type and return a value of the same type as their LHS. Like in Rust, the RHS is
    ///   truncated as needed.
    /// * The `Bit*` operations accept signed integers, unsigned integers, or bools with matching
    ///   types and return a value of that type.
    /// * The remaining operations accept signed integers, unsigned integers, or floats with
    ///   matching types and return a value of that type.
    BinaryOp(BinOp, Operand, Operand),

    /// Performs essentially all of the casts that can be performed via `as`.
    ///
    /// This allows for casts from/to a variety of types.
    Cast(CastKind, Operand, Ty),

    /// Same as `BinaryOp`, but yields `(T, bool)` with a `bool` indicating an error condition.
    ///
    /// For addition, subtraction, and multiplication on integers the error condition is set when
    /// the infinite precision result would not be equal to the actual result.
    CheckedBinaryOp(BinOp, Operand, Operand),

    /// A CopyForDeref is equivalent to a read from a place.
    /// When such a read happens, it is guaranteed that the only use of the returned value is a
    /// deref operation, immediately followed by one or more projections.
    CopyForDeref(Place),

    /// Computes the discriminant of the place, returning it as an integer of type
    /// [`discriminant_ty`]. Returns zero for types without discriminant.
    ///
    /// The validity requirements for the underlying value are undecided for this rvalue, see
    /// [#91095]. Note too that the value of the discriminant is not the same thing as the
    /// variant index; use [`discriminant_for_variant`] to convert.
    ///
    /// [`discriminant_ty`]: crate::ty::Ty::discriminant_ty
    /// [#91095]: https://github.com/rust-lang/rust/issues/91095
    /// [`discriminant_for_variant`]: crate::ty::Ty::discriminant_for_variant
    Discriminant(Place),

    /// Yields the length of the place, as a `usize`.
    ///
    /// If the type of the place is an array, this is the array length. For slices (`[T]`, not
    /// `&[T]`) this accesses the place's metadata to determine the length. This rvalue is
    /// ill-formed for places of other types.
    Len(Place),

    /// Creates a reference to the place.
    Ref(Region, BorrowKind, Place),

    /// Transmutes a `*mut u8` into shallow-initialized `Box<T>`.
    ///
    /// This is different from a normal transmute because dataflow analysis will treat the box as
    /// initialized but its content as uninitialized. Like other pointer casts, this in general
    /// affects alias analysis.
    ShallowInitBox(Operand, Ty),

    /// Creates a pointer/reference to the given thread local.
    ///
    /// The yielded type is a `*mut T` if the static is mutable, otherwise if the static is extern a
    /// `*const T`, and if neither of those apply a `&T`.
    ///
    /// **Note:** This is a runtime operation that actually executes code and is in this sense more
    /// like a function call. Also, eliminating dead stores of this rvalue causes `fn main() {}` to
    /// SIGILL for some reason that I (JakobDegen) never got a chance to look into.
    ///
    /// **Needs clarification**: Are there weird additional semantics here related to the runtime
    /// nature of this operation?
    ThreadLocalRef(stable_mir::CrateItem),

    /// Exactly like `BinaryOp`, but less operands.
    ///
    /// Also does two's-complement arithmetic. Negation requires a signed integer or a float;
    /// bitwise not requires a signed integer, unsigned integer, or bool. Both operation kinds
    /// return a value with the same type as their operand.
    UnaryOp(UnOp, Operand),

    /// Yields the operand unchanged
    Use(Operand),
}

#[derive(Clone, Debug)]
pub enum Operand {
    Copy(Place),
    Move(Place),
    Constant(String),
}

#[derive(Clone, Debug)]
pub struct Place {
    pub local: usize,
    pub projection: String,
}

type FieldIdx = usize;

#[derive(Clone, Debug)]
pub struct SwitchTarget {
    pub value: u128,
    pub target: usize,
}

#[derive(Clone, Debug)]
pub enum BorrowKind {
    /// Data must be immutable and is aliasable.
    Shared,

    /// The immediately borrowed place must be immutable, but projections from
    /// it don't need to be. For example, a shallow borrow of `a.b` doesn't
    /// conflict with a mutable borrow of `a.b.c`.
    Shallow,

    /// Data is mutable and not aliasable.
    Mut {
        /// `true` if this borrow arose from method-call auto-ref
        kind: MutBorrowKind,
    },
}

#[derive(Clone, Debug)]
pub enum MutBorrowKind {
    Default,
    TwoPhaseBorrow,
    ClosureCapture,
}

#[derive(Clone, Debug)]
pub enum Mutability {
    Not,
    Mut,
}

#[derive(Clone, Debug)]
pub enum Safety {
    Unsafe,
    Normal,
}

#[derive(Clone, Debug)]
pub enum PointerCoercion {
    /// Go from a fn-item type to a fn-pointer type.
    ReifyFnPointer,

    /// Go from a safe fn pointer to an unsafe fn pointer.
    UnsafeFnPointer,

    /// Go from a non-capturing closure to an fn pointer or an unsafe fn pointer.
    /// It cannot convert a closure that requires unsafe.
    ClosureFnPointer(Safety),

    /// Go from a mut raw pointer to a const raw pointer.
    MutToConstPointer,

    /// Go from `*const [T; N]` to `*const T`
    ArrayToPointer,

    /// Unsize a pointer/reference value, e.g., `&[T; n]` to
    /// `&[T]`. Note that the source could be a thin or fat pointer.
    /// This will do things like convert thin pointers to fat
    /// pointers, or convert structs containing thin pointers to
    /// structs containing fat pointers, or convert between fat
    /// pointers.
    Unsize,
}

#[derive(Clone, Debug)]
pub enum CastKind {
    PointerExposeAddress,
    PointerFromExposedAddress,
    PointerCoercion(PointerCoercion),
    DynStar,
    IntToInt,
    FloatToInt,
    FloatToFloat,
    IntToFloat,
    PtrToPtr,
    FnPtrToPtr,
    Transmute,
}

#[derive(Clone, Debug)]
pub enum NullOp {
    /// Returns the size of a value of that type.
    SizeOf,
    /// Returns the minimum alignment of a type.
    AlignOf,
    /// Returns the offset of a field.
    OffsetOf(Vec<FieldIdx>),
}
