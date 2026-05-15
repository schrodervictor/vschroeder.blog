---
title: "Baklava Architecture: Your Python App Needs Layers"
description: >
  FastAPI and Flask make it dangerously easy to put everything in one place.
  Database calls in route handlers, business logic scattered across a hundred
  files, no clear boundary between what receives a request and what decides
  what to do with it. Here is how to fix that with proper layering.
pubDate: 2026-05-16
author: Victor Schroeder
tags:
  - software-engineering
  - python
  - practices
  - architecture
  - microservices
---

If you are like me, you also made this mistake at least a few times.
Using FastAPI/Flask/Litestar is easy and gets you up and running so damn
quickly. All the convenience of the microframework compounds nicely in the
bootstrap and first few features. They even come with testing helpers that
allow you to play with the APIs without even having the application running.

It's beautiful, easy, and feels great!

But then you see the reality: database queries inside the route handlers.
Raw SQLAlchemy sessions, right there next to the path parameters and the
response model. Direct calls to external APIs spread everywhere. Endless
imports from internal and external stuff alike. And sorts
of similar issues. Sure it worked. Sure it was fast to write. But within
three months it becomes an unmaintainable mess that nobody wants to touch.

I had been building applications in Python and other languages for years.
FastAPI and friends make it so _easy_ to just grab a dependency, call the
database, and return the result, all in twenty lines. All that convenience
can make the architecture part of our brain go on an unplanned vacation.

But I know better. These are issues that have been solved for decades.

This is not a FastAPI problem. Flask does it. Litestar does it. Django, to
some extent, also does it too. The Python web framework ecosystem gives
you incredible flexibility and speed to get started, but it does not care
about your application's internal structure.

Nor should they. That's our job.

## The framework is not your architecture

Let's face reality: a web framework should handle HTTP. Period. It parses
requests, routes them to handlers, serializes responses, manages middleware.
That is its job and it does it well.

But a web framework is just one of the possible _entry points_ into your
application. Your app might also be invoked by a CLI command, a message
broker consumer, a scheduled job, a gRPC service, or (welcome to 2026) an
MCP server that an AI agent talks to.

If your business logic lives inside your route handlers, it is married to
HTTP. Want to run the same operation from a CLI script? You either duplicate
the logic or you `import` from your web layer into your CLI layer, dragging
along request contexts and a web server you never asked for.

Suddenly you see yourself try/except'ing `HTTPNotFoundException` in the
context of a cronjob. Seriously?

I have seen this pattern _in production_ more times than I can count. The
codebase starts small and clean. A few routes, a few queries. Then features
pile up. Suddenly you have 1,000 lines in a single router file, three
different places where "create user" happens, and nobody can tell you what
the actual business rules are without reading the HTTP layer line by line.

Not to mention all the nesting level... All that nesting! The horror!

The fix is honestly not complicated. It is just discipline.

## Lasagna, baklava, whatever. Just layer it.

Layered architecture is most often discussed in the context of monoliths.
The classic "lasagna" pattern: thick horizontal slabs of presentation, business
logic, and data access stacked on top of each other. Fair enough. But
layering is equally important in microservices.

I know, I know. Microservices were supposed to be small to a point that
internal architecture shouldn't matter too much. That is the pitch. And it is
true for the first six months. Then the "micro" grows. It absorbs a few
related responsibilities. Someone adds a second consumer. A batch job
appears. Before you know it, you have a service with 40 endpoints and no
internal structure. Not "micro", just "smaller" with a Kubernetes deployment.

If monoliths are the lasagna, microservices are the **baklava**: many thin
layers of the same dough, individually delicate, collectively sturdy. Each
service is smaller, but it still needs the same internal discipline. The
layers are thinner, the domain is narrower, but the separation of concerns
is **identical**.

Not by accident.

A well-structured application has clear horizontal layers, each with a
specific role and strict rules about what it can and cannot talk to. This
applies whether your deployment unit is a proud monolith or a fleet of
focused services. The size does not change the internal structure.

Here are the four fundamental layers, plus a few supporting concerns.

### 1st Layer: Handlers

The handler layer is the outermost boundary. It receives external input,
validates it against the expected schema, calls the appropriate service,
and returns the result in the format the caller expects.

Handlers come in many shapes:

- **HTTP controllers** (FastAPI routes, Flask views, Litestar controllers)
- **CLI command handlers** (Click, Typer, cronjobs)
- **Event consumers** (Kafka, RabbitMQ, SQS listeners)
- **MCP tool definitions** (for AI agent integrations)
- **gRPC service methods**

The critical rule: a handler must not contain business logic. Must not be
concerned about data persistence. It knows nothing about internal
implementation. It simply translates between external world input
and the service layer, then gives the response back.

In this process, this is exactly what it should do:
- Receive the external input
- Validate and reject the clearly invalid ones (incomplete payload,
  invalid types, unacceptable instructions, etc)
- Pass externally valid input to the service layer
- Receive the results from the service layer
- Format the output to the expected format (JSON, XML, Markdown, etc)
- Emit success/error signals (exit code, HTTP status codes, etc)


```python
from fastapi import APIRouter, Depends, Response

from app.services.user_service import UserService
from app.models.user import CreateUserRequest, UserResponse
from app.services.results import SuccessResult, ConflictResult

router = APIRouter(prefix="/users")


@router.post("/")
async def create_user(
    body: CreateUserRequest,
    response: Response,
    user_service: UserService = Depends(),
):
    result = await user_service.create(body)

    match result:
        case ConflictResult():
            response.status_code = 409
            return {"error": result.message}
        case SuccessResult():
            response.status_code = 201
            return UserResponse.from_entity(result.user)
```

It looks boring. Good. Stop and think about what this handler is actually
doing: it validates the incoming payload through the Pydantic model (invalid
requests never reach the service), it delegates to the service, it inspects
the result type, it picks the right HTTP status code, and it formats the
response. That is already a lot of responsibility for something that looks
like twenty lines.

And it is _important_ responsibility. By filtering out clearly invalid
input at the boundary, the service layer can concentrate on meaningful
work. By owning the response format and status codes, it frees the
service from knowing anything about HTTP. Simplifying services is the
whole point. They are the most complicated part of the application, as
we will see next. Every bit of noise you keep out of them pays off.

No database session. No conditional business logic. No "if the user is
an admin, also do X." That stuff belongs somewhere else.

Now here is the beautiful part. You can expose the exact same operation
through a CLI command:

```python
# app/handlers/cli/commands.py
import typer
from app.models.user import CreateUserRequest
from app.services.user_service import UserService
from app.services.results import SuccessResult

app = typer.Typer()


def register_commands(user_service: UserService):

    @app.command()
    def create_user(name: str, email: str):
        result = user_service.create(
            CreateUserRequest(name=name, email=email)
        )

        match result:
            case SuccessResult():
                typer.echo(f"Created user {result.user.id}")
            case _:
                typer.echo(f"Error: {result.message}", err=True)
                raise typer.Exit(code=1)
```

Same service, same business logic, different entry point. The service does
not know or care whether it was called from an HTTP request, a terminal, or
a cron job. It just receives validated input and does its thing.

A side note on validation and formatting. Both are mostly stateless
operations: take input, produce output, no side effects. In more complex
applications, you can extract them into their own intermediary layers at
the boundary between handlers and services. Dedicated validators,
response formatters, serializers. This reduces the handler to almost pure
glue and makes the validation rules independently testable.

Whether it is worth the extra indirection depends on how many entry
points you have and how complex the transformations are. For most
services, keeping it in the handler is fine. But if you find yourself
duplicating validation logic across HTTP routes and CLI commands, that
is a sign. This is an advanced topic, maybe something for a future post.

### 2nd Layer: Services

This is the brain of your application. The service layer contains the
business logic: the rules, the decisions, the orchestration. All the ifs
and elses, WTTT's, state machines, etc. It receives validated input from
handlers (any handler, regardless of protocol) and operates on it.

```python
from app.models.user import CreateUserRequest, UserResponse
from app.repositories.user_repository import UserRepository
from app.repositories.audit_repository import AuditRepository


class UserService:

    def __init__(
        self,
        user_repo: UserRepository,
        audit_repo: AuditRepository,
    ):
        self.user_repo = user_repo
        self.audit_repo = audit_repo

    async def create(
        self,
        data: CreateUserRequest,
    ) -> SuccessResult | ConflictResult:
        existing = await self.user_repo.find_by_email(data.email)
        if existing:
            return ConflictResult("A user with this email already exists")

        user = await self.user_repo.create(
            name=data.name,
            email=data.email,
        )

        await self.audit_repo.log_event(
            entity="user",
            entity_id=user.id,
            action="created",
        )

        return SuccessResult(user=user)
```

A few things to notice:

**Dependency injection.** The service receives its repositories and any
other dependencies through the constructor. It does not create database
sessions or instantiate clients.  This is _not_ optional. Without proper
DI, your services become untestable spaghetti and tightly coupled to
specific infrastructure.

**No framework imports.** The service knows nothing about FastAPI, Flask, or
HTTP. It does not import `Request`, it does not access headers, it does not
set status codes. It works with domain objects.

**Orchestration.** The service calls multiple repositories, enforces
business rules ("does this email already exist?"), and coordinates
side-effects (audit logging). This is the kind of logic that, in a
framework-coupled codebase, ends up scattered across handlers, middleware,
and signal hooks.

The service layer is the most important layer to unit test. Because it has
no framework dependencies, you can test it with plain pytest, injecting
mock repositories and verifying behavior without spinning up an HTTP server
or a database.

Trust me, you don't want to write integration tests for _all possible
scenarios_ of your business logic.

Services have handlers above them, the persistence layer "below" them,
clients and other services "around" them. All of these injected
and stubbed as needed. This is extremely important for several reasons:

- **Error simulation is hard with real resources.** Network timeouts,
  connection failures, rate limits, partial writes. These happen
  constantly in production but are nearly impossible to reproduce
  reliably with a live database or API. Same for external API clients:
  do you really want to code a mock container for every service you
  call? With injected fakes, you simulate any failure in one line.
- **Business logic always has too many paths.** The combinatorial
  explosion of conditions, edge cases, and alternative flows is large
  enough without adding input validation variations on top. If the
  handler already rejected malformed payloads, your service tests can
  focus on the actual domain logic.
- **Real resources make test isolation painful.** Ephemeral databases,
  complicated `setUp`/`tearDown` logic, repopulation of known initial
  state. All that compounds into complexity and slowness. A test suite
  that takes minutes instead of seconds is a test suite nobody runs.
  And no shared state means no "this test fails when you run the full
  suite but passes alone."
- **You are not mocking the database.** Please, please, do not mock DB
  engines, SQLAlchemy sessions, query builders, etc. That is a common
  mistake. You are mocking your _repositories_. Something you call
  `user_repo.load(id=42)` and it returns a `User` object or `None`.
  Simple as that. The interface is tiny. The fake is trivial to write.
  I cannot stress this enough.

```python
async def test_create_user_duplicate_email():
    user_repo = FakeUserRepository(
        existing=[User(id=1, name="Ada", email="ada@example.com")]
    )
    audit_repo = FakeAuditRepository()
    service = UserService(user_repo, audit_repo)

    result = await service.create(
        CreateUserRequest(name="Grace", email="ada@example.com")
    )

    assert isinstance(result, ConflictResult)
    assert result.message == "A user with this email already exists"
```

_(You can see by the snippet above that I'm allergic to Exceptions. Indeed.
I defend with all my strength that one **must not** use Exceptions for control
flow and save them for real exceptional situations. A user that already
exists in DB does **NOT** justify throwing an exception. More about this
in a future post)._

No test database. No HTTP client. No fixtures that take 30 seconds to set
up. Just the logic under test.

### 3rd Layer: Persistence

The persistence layer is everything that touches storage or external data
sources. Databases, caches, cloud buckets, search engines, vector stores.
It exposes domain-specific CRUD operations to the service layer and remains
blissfully ignorant of everything else.

```python
from sqlalchemy import select

from app.adapters.database import DatabaseAdapter
from app.models.user import UserEntity


class UserRepository:

    def __init__(self, db: DatabaseAdapter):
        self.db = db

    async def find_by_email(self, email: str) -> UserEntity | None:
        async with self.db.session() as session:
            result = await session.execute(
                select(UserEntity).where(UserEntity.email == email)
            )
            return result.scalar_one_or_none()

    async def create(self, name: str, email: str) -> UserEntity:
        async with self.db.session() as session:
            user = UserEntity(name=name, email=email)
            session.add(user)
            await session.flush()
            return user
```

The repository is dumb on purpose. It does not validate business rules. It
does not decide whether a user _should_ be created. It just knows how to
talk to the database and expose operations that make sense in the domain
vocabulary: `find_by_email`, `create`, `list_active`, not generic
`SELECT * FROM`.

This dumbness is a feature. The persistence layer is like a Rhino: thick-skinned,
not very concerned with what is happening around it, just doing its heavy
job reliably. When it has to run, it runs. But you do not want your Rhino
making business decisions.

One important fact: don't try to cover your repos with unit tests, except for
very specific situations (such as hard-to-simulate errors). Most of the times
you want to exercise the real resource behind the scenes. But with the test
surface very reduced, they will be fast and without concerns about business data
constraints.

### 4th Layer: Data Models

Data models are the vertical layer. They do not sit above or below the
others; they cut through all of them. They are the common language that
every layer uses to communicate.

In Python, these take many forms:

- **Pydantic models** for request/response schemas and validation
- **SQLAlchemy models** (or other ORM entities) for database mapping
- **Dataclasses** for internal DTOs
- **TypedDicts** when you want structure without the overhead

```python
from pydantic import BaseModel, EmailStr
from dataclasses import dataclass


# Request/response models (handler layer speaks these)
class CreateUserRequest(BaseModel):
    name: str
    email: EmailStr


class UserResponse(BaseModel):
    id: int
    name: str
    email: str

    @classmethod
    def from_entity(cls, entity: "UserEntity") -> "UserResponse":
        return cls(id=entity.id, name=entity.name, email=entity.email)


# Database entity (persistence layer speaks this)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UserEntity(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    email: Mapped[str] = mapped_column(unique=True)
```

The key insight: you often have multiple model types for the same concept.
`CreateUserRequest` is what the handler receives. `UserEntity` is what the
database stores. `UserResponse` is what the handler returns. They look
similar but serve different purposes, and trying to collapse them into a
single class always ends in tears (I've been there...).

I know it feels redundant. Three classes for a user? But the moment your
database schema diverges from your API contract (and it will, it always
does), you will be grateful they are separate. The `from_entity` class
method is where the translation happens, and it is the only place you need
to update when either side changes.

## Satellite modules

Beyond the four main layers, a few supporting concerns show up in most
applications.

### Clients

External API clients are weird. Sometimes they act as business logic
(calling a payment gateway is a business decision), sometimes as a
persistence mechanism (fetching data from a third-party REST API is
functionally equivalent to reading from a database).

My rule: if the external service is a _data source_, treat the client like
a repository. If it is an _action_ (send an email, charge a card), wrap it
in a service or call it from a service. Either way, define the client as
its own module with a clear interface:

```python
from app.adapters.http_clients import HttpClientAdapter
from app.models.payment import ChargeResult


class PaymentGatewayClient:

    BASE_URL = "https://api.payment.example"

    def __init__(self, http: HttpClientAdapter, api_key: str):
        self.http = http
        self.api_key = api_key

    async def charge(
        self,
        amount_cents: int,
        token: str,
    ) -> ChargeResult:
        response = await self.http.post(
            f"{self.BASE_URL}/charges",
            json={"amount": amount_cents, "token": token},
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        return ChargeResult(**response)
```

### Utils

Pure functions. No side effects. String formatting, date arithmetic, hash
computation, data transformation. Things that take input and produce output
without touching the outside world.

```python
def slugify(text: str) -> str:
    return text.lower().strip().replace(" ", "-")


def cents_to_display(amount: int, currency: str = "USD") -> str:
    return f"{currency} {amount / 100:.2f}"
```

If your "utils" module has database imports or HTTP clients, it is not a
utils module. Isolate the domain, rename it and make it a proper client,
service or repository.

### Adapters

Adapters are factory functions and wrapper classes that bridge your
application's abstractions with the concrete libraries and infrastructure
you chose. A database adapter wraps SQLAlchemy's engine and session
factory. An HTTP client adapter wraps `httpx`. A message broker adapter
wraps your Kafka producer.

The key idea: adapters are _dormant_ in the codebase. They define how to
create things, but they do not create them eagerly. They only materialize
at the application's entry point.

```python
# app/adapters/database.py
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)


class DatabaseAdapter:

    def __init__(self, url: str, pool_size: int = 10):
        self._engine = create_async_engine(url, pool_size=pool_size)
        self._sessions = async_sessionmaker(
            self._engine, expire_on_commit=False,
        )

    def session(self) -> AsyncSession:
        return self._sessions()
```

The adapter does not decide when to be instantiated or whether it is a
singleton. That decision belongs to the entry point.

Every application needs a clear entry point: the script that stitches
all the moving parts together. This is where connection pools are
created, Kafka consumers are connected, dependency injection containers
are configured, and singletons become singletons. Your `__main__.py`
(or equivalent bootstrap function) is the place where the dormant
adapters come to life:

```python
# app/main.py
from app.adapters.database import DatabaseAdapter
from app.adapters.http_clients import HttpClientAdapter
from app.config import settings


def create_app():
    db = DatabaseAdapter(settings.database_url, pool_size=20)
    http = HttpClientAdapter()

    app = FastAPI()
    app.state.db = db
    app.state.http = http
    return app
```

For a CLI entry point, the same adapters may get wired differently:

```python
# app/cli.py
from app.adapters.database import DatabaseAdapter
from app.config import settings


def bootstrap():
    db = DatabaseAdapter(settings.database_url, pool_size=2)
    return ServiceFactory(db)
```

Same adapters, same services, different wiring. The CLI might use a
smaller connection pool or skip the payment client entirely. The entry
point decides.

This separation gives you three things:
- **Performance**: expensive resources like connection pools are created once
  at startup, not on every request
- **Testability**: in tests you replace the entire adapter with a fake, no
  monkey-patching, no module-level globals to wrestle with.
- **Flexibility**: if you swap `httpx` for `aiohttp`, you change the adapter.
  Nothing else notices.

## What it looks like

Here is a directory structure that reflects these layers. Nothing radical.
Just directories with clear names:

```
app/
├── entrypoint.py
├── handlers/
│   ├── http/
│   │   ├── user_routes.py
│   │   └── order_routes.py
│   ├── cli/
│   │   └── commands.py
│   └── consumers/
│       └── order_events.py
├── services/
│   ├── user_service.py
│   └── order_service.py
├── repositories/
│   ├── user_repository.py
│   ├── order_repository.py
│   └── audit_repository.py
├── clients/
│   ├── payment_gateway.py
│   └── email_provider.py
├── models/
│   ├── user.py
│   ├── order.py
│   └── payment.py
├── adapters/
│   ├── database.py
│   ├── http_clients.py
│   └── service_factories.py
└── utils/
    ├── formatting.py
    └── crypto.py
```

Your handlers are grouped by protocol. Your services are grouped by domain.
Your repositories are grouped by storage concern. Models are shared. The
adapters provide access to real resources and the entrypoint wires everything
together.

## The dependency rule

There is one rule that holds the whole thing together: **dependencies point
inward**.

- Handlers depend on services. Never the other way around and never on
  anything else.
- Services depend on repositories, clients and other services. Never on
  handlers.
- Repositories depend on the adapter and the ORM.
- Clients depend only on the adapter.
- All the above will depend on a subgroup of models (vertical layer).
- Adapters, models and utils depend on nothing.

If you ever find yourself importing a handler inside a service, or a
service inside a repository, stop. You are violating the dependency rule
and your architecture just started to fall apart.

This rule is what makes the layering work. It is what allows you to test
services without HTTP, to swap databases without touching business logic,
to add a new entry point (CLI, gRPC, MCP) without rewriting a single line
of domain code.

It sounds almost religious when you write it down, like some Vulcan logic
principle that tolerates no exceptions, no emotions. And honestly? It kind
of is. The purity pays off.

## "But this is just a small app"

I hear this a lot. "We only have five routes, we don't need all this
ceremony." And sure, for a quick prototype or a weekend hack, throw
everything in one file. Nobody is going to judge you.

But here is the thing: small apps grow. They always do. Nobody ever built a
"small app" that stayed small. The five routes become twenty. The single
database query becomes a transaction spanning three tables. The prototype
you swore would never go to production is now handling real traffic and
someone on the team is afraid to touch it because the business logic is
hiding in a `Depends()` callback three levels deep.

This goes double for microservices. The whole point of splitting into
services was to keep things small and manageable. But if each small service
is internally a mess, you have not simplified anything:

**You have just distributed the mess.**

Now instead of one untestable monolith, you have thirty untestable services
calling each other over the network. Your baklava has no layers, just crumbs,
and it is effectively worse than a messy lasagna.

Starting with layers does not cost you much. A few extra files, a few extra
imports. The overhead is minimal. But retrofitting layers onto a
framework-coupled codebase that has been growing organically for a year?
That is a full rewrite. I have been through some of those. Good luck.

## The real payoff

When your application is properly layered, something almost magical
happens: you can reason about it.

What happens when a user is created? Read `UserService.create`. That is
the source of truth, not the route handler, not the migration, not the
middleware. Need a new entry point? Write a handler, wire it to the
same service, done. Swapping PostgreSQL for DynamoDB? Change the
repository and the adapter. The service keeps calling
`user_repo.find_by_email()` and has no idea anything changed.

But the real payoff is in testing. Inject fakes, call the service,
assert the result. No containers, no test databases, no HTTP servers
spinning up just so you can check a business rule. Milliseconds per
test. Hundreds of scenarios before your coffee gets cold.

This is not theoretical. This is how you build applications that survive
contact with reality. The ones that can be maintained by a team, extended
without fear, and debugged without archaeology.

The framework gives you speed. The layers give you longevity. Embrace
both early, or pay later.
