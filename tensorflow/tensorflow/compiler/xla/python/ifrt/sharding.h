/* Copyright 2022 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

#ifndef TENSORFLOW_COMPILER_XLA_PYTHON_IFRT_SHARDING_H_
#define TENSORFLOW_COMPILER_XLA_PYTHON_IFRT_SHARDING_H_

#include <memory>
#include <ostream>
#include <string>
#include <utility>
#include <vector>

#include "llvm/Support/ExtensibleRTTI.h"
#include "tensorflow/compiler/xla/python/ifrt/device.h"
#include "tensorflow/compiler/xla/python/ifrt/index_domain.h"
#include "tensorflow/compiler/xla/python/ifrt/ir/sharding_param.h"
#include "tensorflow/compiler/xla/python/ifrt/serdes.h"
#include "tensorflow/compiler/xla/python/ifrt/shape.h"
#include "tensorflow/compiler/xla/statusor.h"

namespace xla {
namespace ifrt {

// TODO(hyeontaek): Unify sharding types with jax::Sharding.

// Abstract sharding type.
//
// TODO(hyeontaek): There is an indication that we may prefer to split logical
// partitioning and device assignment into two separate data structures. It is
// common that an operation preserves the logical partitioning and only updates
// devices (e.g., "copy to devices" and portable execution). This fine-grained
// sharding design may help reduce overhead around these operations.
class Sharding : public llvm::RTTIExtends<Sharding, Serializable> {
 public:
  // All devices in this sharding. Devices may appear more than once.
  const DeviceList& devices() const { return devices_; }

  // Breaks a shape up into per-device shapes and shardings. See
  // Array::DisassembleIntoSingleDeviceArrays(). It may return an error if
  // disassembly is unsupported.
  virtual StatusOr<
      std::vector<std::pair<Shape, std::shared_ptr<const Sharding>>>>
  Disassemble(const Shape& shape) const = 0;

  // Maps each shard to an `IndexDomain` over `shape`. The result is a list of
  // `index_domain_i` such that `array[index_domain_i] = disassembled_array_i`.
  // Note that multiple shards may map onto equal `IndexDomain`. For instance, a
  // fully replicated sharding would return a vector of `[IndexDomain(shape)] *
  // devices().size()`.
  virtual StatusOr<std::vector<IndexDomain>> IndexDomains(
      const Shape& shape) const = 0;

  virtual std::string DebugString() const = 0;

  static char ID;  // NOLINT

 protected:
  explicit Sharding(DeviceList devices) : devices_(devices) {}

  DeviceList devices_;
};

std::ostream& operator<<(std::ostream& os, const Sharding& sharding);

// Single-device sharding.
//
// TODO(hyeontaek): `SingleDeviceSharding` tends to be created or consumed in a
// large quantity. It may be useful for performance optimization to special-case
// this sharding type rather than expressing it as a general `Sharding`.
class SingleDeviceSharding final
    : public llvm::RTTIExtends<SingleDeviceSharding, Sharding> {
 public:
  // Creates a single-device sharding.
  static std::unique_ptr<Sharding> Create(Device* device);

  // Sharding implementation.

  ~SingleDeviceSharding() override = default;

  StatusOr<std::vector<std::pair<Shape, std::shared_ptr<const Sharding>>>>
  Disassemble(const Shape& shape) const override;

  StatusOr<std::vector<IndexDomain>> IndexDomains(
      const Shape& shape) const override;

  std::string DebugString() const override;

  static char ID;  // NOLINT

 private:
  explicit SingleDeviceSharding(Device* device)
      : llvm::RTTIExtends<SingleDeviceSharding, Sharding>(
            DeviceList({device})) {}
};

// Opaque sharding that does not define a fixed semantics for conversion between
// a logical shape and per-device shapes, and device placements.
class OpaqueSharding : public llvm::RTTIExtends<OpaqueSharding, Sharding> {
 public:
  // Creates an opaque sharding. `Disassemble()` will fail.
  static std::unique_ptr<Sharding> Create(DeviceList devices);

  // Sharding implementation.

  ~OpaqueSharding() override = default;

  StatusOr<std::vector<std::pair<Shape, std::shared_ptr<const Sharding>>>>
  Disassemble(const Shape& shape) const override;

  StatusOr<std::vector<IndexDomain>> IndexDomains(
      const Shape& shape) const override;

  std::string DebugString() const override;

  static char ID;  // NOLINT

 private:
  explicit OpaqueSharding(DeviceList devices);
};

// Opaque sharding that does not define a fixed semantics for conversion between
// a logical shape and shard shapes, and device placements. It can disassemble a
// certain shape into shard shapes that may not be identical. It is advised to
// use `ConcreteEvenSharding` if all shard shapes are identical.
class ConcreteSharding : public llvm::RTTIExtends<ConcreteSharding, Sharding> {
 public:
  // Creates a concrete sharding that may contain non-identical shard shapes.
  // REQUIRES: devices.size() == shard_shapes.size()
  static std::unique_ptr<Sharding> Create(DeviceList devices, Shape shape,
                                          std::vector<Shape> shard_shapes);

  Shape shape() const {
    DCHECK(this);
    return shape_;
  }
  const std::vector<Shape>& shard_shapes() const {
    DCHECK(this);
    return shard_shapes_;
  }

  // Sharding implementation.

  ~ConcreteSharding() override = default;

  StatusOr<std::vector<std::pair<Shape, std::shared_ptr<const Sharding>>>>
  Disassemble(const Shape& shape) const override;

  StatusOr<std::vector<IndexDomain>> IndexDomains(
      const Shape& shape) const override;

  std::string DebugString() const override;

  static char ID;  // NOLINT

 private:
  ConcreteSharding(DeviceList devices, Shape shape,
                   std::vector<Shape> shard_shapes);

  Shape shape_;
  std::vector<Shape> shard_shapes_;
};

// Opaque sharding that does not define a fixed semantics for conversion between
// a logical shape and shard shapes, and device placements. It can disassemble a
// certain shape into shard shapes that are identical.
class ConcreteEvenSharding
    : public llvm::RTTIExtends<ConcreteEvenSharding, Sharding> {
 public:
  // Creates a concrete even sharding.
  static std::unique_ptr<Sharding> Create(DeviceList devices, Shape shape,
                                          Shape shard_shape);

  Shape shape() const {
    DCHECK(this);
    return shape_;
  }
  const Shape& shard_shape() const {
    DCHECK(this);
    return shard_shape_;
  }

  // Sharding implementation.

  ~ConcreteEvenSharding() override = default;

  StatusOr<std::vector<std::pair<Shape, std::shared_ptr<const Sharding>>>>
  Disassemble(const Shape& shape) const override;

  StatusOr<std::vector<IndexDomain>> IndexDomains(
      const Shape& shape) const override;

  std::string DebugString() const override;

  static char ID;  // NOLINT

 private:
  ConcreteEvenSharding(DeviceList devices, Shape shape, Shape shard_shape);

  Shape shape_;
  Shape shard_shape_;
};

// Sharding derived from an IR ShardingParam.
class ShardingParamSharding
    : public llvm::RTTIExtends<ShardingParamSharding, Sharding> {
 public:
  static StatusOr<std::unique_ptr<Sharding>> Create(
      ShardingParam sharding_param, DeviceList devices);

  StatusOr<std::vector<std::pair<Shape, std::shared_ptr<const Sharding>>>>
  Disassemble(const Shape& shape) const override;

  StatusOr<std::vector<IndexDomain>> IndexDomains(
      const Shape& shape) const override;

  std::string DebugString() const override;

  static char ID;  // NOLINT

 private:
  ShardingParamSharding(ShardingParam sharding_param, DeviceList devices)
      : llvm::RTTIExtends<ShardingParamSharding, Sharding>(devices),
        sharding_param_(sharding_param) {}

  ShardingParam sharding_param_;
};

}  // namespace ifrt
}  // namespace xla

#endif  // TENSORFLOW_COMPILER_XLA_PYTHON_IFRT_SHARDING_H_
