# VoidSector Quest System Design

## Overview

The VoidSector quest system mixes **story progression**, **procedural
exploration**, and **player-driven universe events**.

Quests are divided into several categories to allow both narrative
storytelling and sandbox gameplay.

------------------------------------------------------------------------

# Quest Categories

## 1. Story Quests

Drive the main narrative of humanity discovering its place in the
universe.

Characteristics: - Triggered by major discoveries - Usually linear
chains - Introduce alien races

Examples: - First Contact - The Galactic Archive - The Center of the
Universe

------------------------------------------------------------------------

## 2. Exploration Quests

Generated when players discover:

-   new star systems
-   alien signals
-   anomalies
-   ruins

Examples: - Scan an unknown structure - Investigate a crashed probe -
Chart a nebula

------------------------------------------------------------------------

## 3. Alien Faction Quests

Each alien species provides mission types aligned with its culture.

Examples:

Archivists: - Collect astronomical data - Recover lost archives

K'thari: - Fleet escort - Combat trials

Consortium: - Trade deliveries - Resource logistics

------------------------------------------------------------------------

## 4. Dynamic Event Quests

Triggered by the simulation of the universe.

Possible triggers:

-   wars
-   ecological collapse
-   trade shortages
-   pirate activity

Example: "Emergency Mineral Supply"

------------------------------------------------------------------------

## 5. Community Quests

Large scale tasks completed by all players on a server.

Examples:

Build Interstellar Embassy\
Stabilize Wormhole Network\
Construct Deep Space Observatory

Community quests influence:

-   diplomacy
-   technology access
-   global reputation

------------------------------------------------------------------------

# Quest Structure

Each quest consists of:

QuestID\
Title\
Type\
StartCondition\
Objectives\
Branches\
ReputationEffects\
Rewards

Example structure:

Quest - id - title - description - objectives - completion_state -
faction_effect - reward

------------------------------------------------------------------------

# Branching Outcomes

Many quests allow different outcomes:

Diplomatic solution\
Scientific solution\
Military solution

The chosen approach affects alien reputation.

------------------------------------------------------------------------

# Reputation Layers

Reputation exists on three levels:

Player Reputation\
Faction Reputation\
Humanity Reputation

Actions by many players can influence how alien species treat all
humans.
