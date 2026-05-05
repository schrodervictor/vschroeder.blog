---
title: "OpenTelemetry Metric Types: a Field Guide"
description: >
  OTel gives you seven metric types, and picking the wrong one costs you. A
  practical breakdown of Counters, Gauges, Histograms, and the rest, with a
  short intro on how the whole system fits together.
pubDate: 2026-05-05
author: Victor Schroeder
tags:
  - observability
  - opentelemetry
  - reference
  - tools
---

Observability can be a very tricky topic. Every vendor has their own naming,
every framework has its own abstractions, and the standards are dense enough to
make you want to go back to `print` statements.

Luckily an industry standard emerged to fix the mess: **OpenTelemetry**.

OTel, for short, is a vendor-neutral standard for collecting and exporting
telemetry data. It covers metrics, logs, and traces. The project is part of the
CNCF since 2019 and is widely adopted. If you are instrumenting a new service
today, OTel is probably the solution you want to understand how your application
is doing.

However, even a strong standard like OTel has its challenges. After spending
enough time staring at Grafana dashboards, trying to figure out the PromQL
queries and configure reasonable alerts, sometimes it becomes clear that some
metrics are simply useless, because they don't measure what you need or are
simply using the wrong metric type.

This post focuses on the **metrics** side of OTel. Specifically, what a time
series actually is, the seven metric types OTel defines, what each one measures,
and how to choose the right one.

## Time series, names, and attributes

One very fundamental concept that may sound a bit alien for someone being
introduced to the topic is what _exactly_ a **time series** is and how it is
organized.

At its core, a time series is just a stream of numbers recorded over time. Think
of it as an append-only table, where each row has a timestamp and a value. But
how does the backend know which stream is which? That is where metric names and
attributes come in.

Metrics in OTel are produced by **instruments**. An instrument is a named object
you create once and call repeatedly to record measurements. The name identifies
the broad category of what you are measuring, like `http.server.requests`.

Each measurement can also have **attributes** (often called labels in other
systems). These are key-value pairs that will be useful to slice the data. For
example, `{"http.method": "GET", "http.status_code": "200"}`.

But bear in mind: every unique combination of a metric name and its attributes
creates a brand new time series.

If you have a metric named `http.server.requests` and you add an attribute for
the HTTP method (`GET`, `POST`, `PUT`), you now have three time series. Add
another attribute for the status code (`200`, `404`, `500`) and you have nine.
This is called **cardinality**. If you put a user ID or a session token in an
attribute, you will create millions of time series. Congratulations! You just
blew up your metrics backend. I have seen this happen more times than I care to
admit. **Keep your attributes bounded**.

## How OTel works (the short version)

Before we get to the types, let's do a quick orientation on how the system
works. OTel has three main components:

- **The API**: the interfaces your application calls to record telemetry. It is
  language-specific and intentionally minimal. Importing the API does not import
  an implementation.
- **The SDK**: the implementation. It handles batching, sampling, and export.
  You configure it once (usually at startup) and the API calls flow through it.
- **The Collector**: an optional (but common) infrastructure component that
  receives telemetry from your applications, processes it, and forwards it to
  one or more backends like Prometheus or Datadog.

```python
# The API: what your application code uses to record data
from opentelemetry import metrics

meter = metrics.get_meter("my-service")

# The SDK: what you configure once at startup to export the data
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import (
    OTLPMetricExporter
)

reader = PeriodicExportingMetricReader(OTLPMetricExporter())
provider = MeterProvider(metric_readers=[reader])
metrics.set_meter_provider(provider)
```

The type of the instrument determines what kind of measurements it accepts, how
the SDK aggregates them, and what queries you can run on the backend.

## The metrics: seven instrument types

OTel defines seven instrument types. They fall into two camps: **synchronous**
(called directly from your code, at the moment something happens) and
**asynchronous** (registered with a callback that OTel calls periodically to
collect a current value).

For each instrument, most of the time you will want to create and keep an
instance for the whole lifetime of the application. Usually the OTel libraries
will take care of keeping the singletons for you transparently.

The OTel Python library, for example, will deduplicate instrument instances
based on the metric name, meaning that it is safe to try to create the same
instance multiple times. You'll always get the same instrument consistently.

### Counter (sync)

A **Counter** records values that only go up. Requests served, bytes sent,
errors raised. The number resets to zero when the process restarts, but it never
decrements during the lifetime of the process.

```python
from opentelemetry import metrics

meter = metrics.get_meter("my-service")
request_counter = meter.create_counter(
    "http.server.requests",
    unit="1",
    description="Total HTTP requests handled",
)

# Called once per request
request_counter.add(1, {"http.method": "GET", "http.status_code": "200"})
```

Counters are synchronous. You call `.add()` at the point in your code where the
thing happens.

On the backend, counters are usually queried as **rates**. "Requests per second"
is a lot more useful than "total requests since the server started". In
Prometheus, that translates to `rate(http_server_requests_total[5m])`.

Use a Counter when the value can only increase over time.

### UpDownCounter (sync)

An **UpDownCounter** is exactly what it sounds like. It is a Counter that can go
down. Active connections, items in a queue, current cache size.

```python
active_connections = meter.create_up_down_counter(
    "db.client.connections.active",
    unit="{connections}",
    description="Number of active database connections",
)

# On connect
active_connections.add(1, {"db.pool": "primary"})

# On disconnect
active_connections.add(-1, {"db.pool": "primary"})
```

Use an UpDownCounter when the value fluctuates and you want to track the current
level, but you are updating it from code (not polling for it).

### Histogram (sync)

A **Histogram** records a distribution of values. How long did requests take?
How large were the payloads? You are not asking "how many?" (Counter) or "what
is it right now?" (Gauge), but "what does the spread look like?".

```python
request_duration = meter.create_histogram(
    "http.server.duration",
    unit="ms",
    description="Duration of HTTP server requests",
)

# Called after handling a request
request_duration.record(
    elapsed_ms,
    {"http.method": "GET", "http.route": "/api/users"},
)
```

The SDK buckets the recorded values and exports counts per bucket. On the
backend you can compute percentiles like p50, p95, and p99. This is what you
want for latency, response size, queue depth over time, or anything where the
_shape_ of the distribution matters, not just the total or the current value.

From a Prometheus perspective, the example above translates into multiple time
series exposed on a scrape endpoint. You get a series for each bucket, plus the
sum and count:

```text
http_server_duration_milliseconds_bucket{http_method="GET",http_route="/api/users",le="10"} 0
http_server_duration_milliseconds_bucket{http_method="GET",http_route="/api/users",le="100"} 12
http_server_duration_milliseconds_bucket{http_method="GET",http_route="/api/users",le="1000"} 15
http_server_duration_milliseconds_bucket{http_method="GET",http_route="/api/users",le="+Inf"} 15
http_server_duration_milliseconds_sum{http_method="GET",http_route="/api/users"} 1345.2
http_server_duration_milliseconds_count{http_method="GET",http_route="/api/users"} 15
```

As you can see, with a histogram you get `sum` aggregation and a `Counter` for
free. You won't need to add a counter for the same event.

Histograms have a cost. They are more expensive to store and query than
counters. Do not reach for a histogram when a counter will do. Think of
histograms as the photon torpedoes of metrics: powerful, but you only have so
many of them in your ship's weaponry.

Use a Histogram when you care about latency, percentiles, or the distribution of
a measured quantity.

### Gauge (sync)

A **Gauge** is a synchronous instrument that records non-additive values when
they occur. It is useful for recording values like the processing speed of a
batch job or a room's temperature, where the value makes sense as an independent
snapshot.

Unlike its asynchronous counterpart, you use a regular Gauge when the value is
being produced or observed in line with your application's flow, rather than
being polled periodically.

```python
job_speed = meter.create_gauge(
    "job.processing_speed",
    unit="{items}/s",
    description="Speed of the batch job",
)

# Called when the job finishes
job_speed.record(42.5, {"job.name": "daily_report"})
```

**Gotcha #1: Aggregation drops data.** You must understand how this plays with
the OTel export interval. Because a Gauge represents a snapshot, the SDK's
default aggregation for it is **Last Value**. If you record multiple values to a
synchronous Gauge within the same export interval (e.g., you record `100`,
`200`, and `50` in a 60-second window), the SDK will **drop the first two and
only export the last one** (`50`).

If you care about every value that occurred during the window—maybe you want to
know the average speed or see the distribution—a Gauge is the wrong tool. You
should use a **Histogram** instead.

**Gotcha #2: Gaps in the graph.** Because this is a synchronous, event-driven
instrument, the SDK only knows about the value when you explicitly call
`.record()`. If an entire export interval passes without a single observation,
the SDK exports nothing for that time series. Your backend will show a gap in
the graph. If you want a continuous line that reports a value every interval
regardless of activity, you want an **Observable Gauge** instead.

Use a Gauge when you are recording independent, non-additive snapshots as they
happen, and you only care about the most recent value.

### Observable Counter (async)

The **Observable Counter** is the asynchronous version of the Counter. Instead
of calling `.add()` when something happens, you register a callback that OTel
calls on its own collection interval. The callback returns the _current
cumulative total_.

```python
import os

def collect_cpu_time(options):
    # os.times() returns (user, system, ...) in seconds
    t = os.times()
    yield metrics.Observation(t.user, {"cpu.state": "user"})
    yield metrics.Observation(t.system, {"cpu.state": "system"})

meter.create_observable_counter(
    "process.cpu.time",
    callbacks=[collect_cpu_time],
    unit="s",
    description="CPU time consumed by the process",
)
```

Use an Observable Counter when the cumulative value is maintained externally (by
the OS, a driver, a library) and you are just reading it, not tracking it
yourself.

### Observable UpDownCounter (async)

The asynchronous version of the UpDownCounter. Good for values that fluctuate
and are owned by something outside your direct control.

```python
import threading

def collect_thread_count(options):
    yield metrics.Observation(threading.active_count())

meter.create_observable_up_down_counter(
    "process.runtime.thread_count",
    callbacks=[collect_thread_count],
    unit="{threads}",
    description="Number of active threads in the process",
)
```

Use an Observable UpDownCounter when you are reading a current level from an
external source on a polling basis.

### Observable Gauge (async)

The **Observable Gauge** is for values that are already meaningful on their own,
point-in-time, and shouldn't be summed across instances. CPU temperature, memory
usage percentage, a feature flag value, a config version number.

```python
import psutil

def collect_memory(options):
    mem = psutil.virtual_memory()
    yield metrics.Observation(mem.percent, {"host": "web-01"})

meter.create_observable_gauge(
    "system.memory.usage",
    callbacks=[collect_memory],
    unit="%",
    description="Memory utilization percentage",
)
```

The key distinction from an UpDownCounter: a Gauge is a snapshot. You are not
tracking changes, you are reading the current state. Adding two Gauges from two
hosts gives you a meaningless number. Adding two UpDownCounters (active
connections from two load balancers) might actually be useful.

Use an Observable Gauge when the value is a current reading, and summing it
across instances has no sensible interpretation.

## Picking the right type

1. Does the value only go up? Use **Counter** (sync) or **Observable Counter**
   (async).
2. Does the value go up _and_ down?
   - Are you tracking it yourself in code? Use **UpDownCounter**.
   - Are you reading it from something external, like a DB? Go for an
     **Observable UpDownCounter**.
3. Do you care about distribution or percentiles? It's a **Histogram**.
4. Is it a point-in-time snapshot that shouldn't be aggregated?
   - Recording it as it happens? **Gauge**.
   - Polling it periodically? **Observable Gauge**.

The sync vs async choice is usually forced by the situation. If you are at the
call site where the thing happens, use a synchronous instrument. If you are
reading a value that already exists somewhere, use an asynchronous one.

## A note on naming

OTel has a naming convention for metric instruments that is worth following if
you want your metrics to work well with standard dashboards and alerts:

- Use dots as separators: `http.server.duration`, not `http_server_duration`
- Use the semantic conventions where they exist: `http.server.*`, `db.client.*`,
  `process.*` are all defined in the OTel spec
- Always set `unit`, using the [UCUM](https://ucum.org/) notation: `ms` for
  milliseconds, `By` for bytes, `1` for dimensionless counts. If you need to use
  a custom countable word like "connections" or "items", UCUM requires you to
  wrap it in curly braces as an annotation: `{connections}`.

The semantic conventions live in the OTel spec and are worth a read before
naming your own instruments. Staying consistent with them means existing
dashboards and alert rules may work out of the box when you plug in a new
backend.

## OTel is the pipeline, not the backend

A common point of confusion is mistaking OpenTelemetry for a complete
observability backend. OTel is the pipeline. It provides the APIs to emit data
from your code, and the Collector to process and route it.

The **OTel Collector** is a massive part of the ecosystem. It is an
infrastructure component designed to receive, process, filter, sample, and
export telemetry data before it reaches your backend. It acts as a buffer and a
router. This means your applications only need to know how to send data to the
Collector, not to the final destination.

OTel does not store your data long-term, nor does it give you dashboards to
visualize it. That is where backends like Prometheus, Grafana, or Datadog come
in. Details on how all these work together will be covered in future posts.

## Where to go next

The OTel documentation has a
[metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
reference that covers the full spec if you ever need it, but for most
instrumentation cases, the seven types above cover everything.

Take the time to understand your metric types before instrumenting your code.
Your future self will thank you when the production alerts go off and your
dashboards actually make sense.
