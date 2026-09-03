# State of play

Orient and Report print this block inside a fenced `text` block so the column alignment survives the
terminal. Orient stops after the Stale line; Report prints the whole block. A line with nothing to
show reads `none`; never drop the line.

```text
State of play · <date>

Increments  (lead first)
  <title>     <open> open · <ready> Ready · <converging|not converging> (<closed> closed in 4 weeks)
  …
Done test   <the lead increment's done test>

Interrupts
  main CI     <green|red: <workflow> on <sha>, #<issue_number>>
  bugs        #<issue_number> <title> · …
  advisories  #<issue_number> · …
  upkeep      <count> ready
  security    #<issue_number> · …

Pick next
  1. #<issue_number>  <title>                    <P<n>>   blocks <count>
  2. …
Owner's picks   #<issue_number> <title> · …

Critical path   #<issue_number> → #<issue_number> → … · root: <agent|owner (<what the owner does>)>
Stale 30d       #<issue_number> · …

Changed this cycle
  - <edit class> on <count> issues

Decisions
  1. <exact state edit> — <reason>

Next   <role|waiting>
```
