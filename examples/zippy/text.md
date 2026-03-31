---
columns: 1
columnWidth: 1200
dropCap: true
accentColor: '#7c6ee6'
h1MaxFontSize: 120
headingUnderline: true
pointerEventsNone: 'title'
ogDescription: 'A ground-up explanation of popular zero-knowledge proving systems.'
ogImage: 'https://vreff.github.io/Wurd/examples/zippy/og.png'
ogUrl: 'https://vreff.github.io/Wurd/examples/zippy/'
---

# Zippy {#title}

## A Basic Zero-Knowledge Protocol to Build Intuition on the Popular Proving Systems

[plugin:binary-stream]
rows: 11
position: absolute
top: 60px
left: var(--content-left)
right: var(--content-right)
[/plugin]

In this guide, we're going to build a toy zero-knowledge proving system called Zippy. It can only do one thing: prove that you know the 4th root of a number, without revealing what that 4th root is. It should not require anything more than middle school math to understand, and by the end you'll have a foundational intuition for how the real proving systems work.


[block]
The general steps that Zippy follows are:

\[plugin:accordion]
1. Execute the computation and convert the results to data points | Run the program on your secret inputs, collect every intermediate value, and line them up as (x, y) coordinates. This is the execution trace converted into plottable data.
2. Use the data points to draw a curve | Feed those coordinates into polynomial interpolation so they define a single, unique polynomial of the lowest possible degree.
3. Validate that the curve satisfies a set of constraints | Define transition and boundary constraints that must hold at specific points on the polynomial, then prove they hold everywhere by evaluating at a random challenge point.
4. Commit to this curve | Lock the polynomial into a commitment scheme so the verifier knows it has the right degree, without ever seeing the original data.
\[/plugin]
[/block]

### Why this guide?

There is no shortage of great guides on the basics of zero-knowledge proofs[plugin:cite]Chainlink, "What Is a Zero-Knowledge Proof (ZKP)?", https://chain.link/education/zero-knowledge-proof-zkp[/plugin], but there is a chasm between those guides — which mainly focus on the concept of a zero-knowledge proof — and actually understanding how today's proving systems verify computation. The learning curve goes from basic logical arguments straight to advanced algebra and number theory.

The proving systems of today bring together a few highly technical concepts: execution traces, arithmetization, polynomial interpolation, constraints, and commitment schemes. Zippy uses all of these, in a simplified form. Some aspects of Zippy are closest to a STARK[plugin:cite]Ben-Sasson, Bentov, Horesh, Riabzev, "Scalable, Transparent, and Post-quantum Secure Computational Integrity", 2018, https://eprint.iacr.org/2018/046[/plugin], but the general steps are the same ones followed by both SNARKs and STARKs. If you understand this guide, you will be able to use that understanding to tackle the much more complicated, more specific system of your choice.

### Step 1. Execute the computation and convert the results to data points

In zero-knowledge proving systems, the two parties involved are usually called the prover and the verifier. The prover is trying to convince the verifier about some fact. This fact may be something like the following: "I know a secret that has some property you care about." In our case, the fact that the prover wants to prove is "I know the 4th root of some number." In other cases, it might be: "I have an identification card that proves I am 18 or older." The main purpose of a zero-knowledge protocol is to prove that fact without revealing anything else: the prover doesn't need to reveal the 4th root to prove that they know it. I don't need to show my ID card to prove I'm 18.

Moving away from the very general concept of what zk is, we can now target how it is implemented for real developer systems. The model that deployed zk platforms use, such as Noir, Circom, Cairo, and others, is one of computation: the prover executes a computer program, and then uses a zero-knowledge proof to convince a verifier that this computer program ran on some unknown secret inputs, and then produced outputs that are shared with them. The computer program may be anything! It can be a program that squares numbers, like we'll be using in this guide, or a machine learning system that can detect features from images. Whatever the program is, the zero-knowledge proof ensures that the inputs and execution trace of that program are private, and only the results of that program are shared.

For this guide, the program we will be using can do one thing: calculate \[plugin:math\]x^4\[/plugin\] for some input \[plugin:math\]x\[/plugin\], by squaring \[plugin:math\]x\[/plugin\] and then squaring \[plugin:math\]x^2\[/plugin\]. It's a very simple program. Our input to this program will be 2, and as you could guess, our output will be \[plugin:math\]2^4 = 16\[/plugin\].

The first step in a proving system is to execute the program to get your outputs from your secret inputs. There's nothing special here, just do the math:

[block]
\[plugin:math\]\[2 \\times 2 = 4\]\[/plugin\]

\[plugin:math\]\[4 \\times 4 = 16\]\[/plugin\]
[/block]

We have our secret input 2, an intermediate value 4, and our final output \[plugin:math\]2^4 = 16\[/plugin\]. The combination of all these values is known as the **execution trace**. While in this simple proving system, the execution trace is just a few multiplication results, in real proving systems it is often the execution of actual machine code: registers, memory addresses, and instructions from the computer's instruction set being executed!

Next, we line up our execution trace into a table — a process known as **arithmetization**:

\[plugin:table\]A simple table with two columns: "Row Number" and "Values".
Row 1: Row Number = 1, Values = 2
Row 2: Row Number = 2, Values = 4
Row 3: Row Number = 3, Values = 16
Compact styling, centered content.\[/plugin\]

Finally, we convert each cell into a coordinate, with the row number as the x-coordinate and the value as the y-coordinate:

\[plugin:table\]A single-column table with header "Values" containing coordinate pairs.
Row 1: (1, 2)
Row 2: (2, 4)
Row 3: (3, 16)
Compact styling, centered content.\[/plugin\]

The important intuition here is that any set of data can be turned into points. If you have some list of values, say 1, 10, 100, 1000, 10000, those items can be represented as points: (1, 1), (2, 10), (3, 100), (4, 1000), (5, 10000). The x-value is just the index and the y-value is the original value. The idea of converting data into points and then doing things with those points was originally pioneered in **Reed-Solomon encoding**[plugin:cite]Reed, Solomon, "Polynomial Codes over Certain Finite Fields", 1960, https://doi.org/10.1137/0108018[/plugin] — a technique present in DVDs, Blu-ray, QR codes, barcodes, text messages, video streaming, and more. It also happens to be very useful for cryptography and zk proofs, as we'll see.

### Step 2. Convert the data points to a function

This is where we start to do weird things. But don't worry! It will all be explained in relatively plain terms.

Now that our table is a single column with 3 points, we can treat those points like they are points on a curve, and our column becomes a function. We can call the function we are creating from our column \[plugin:math\]f\[/plugin\]. For \[plugin:math\]f(x)\[/plugin\], our values for \[plugin:math\]f\[/plugin\] are \[plugin:math\]f(1) = 2\[/plugin\], \[plugin:math\]f(2) = 4\[/plugin\], and \[plugin:math\]f(3) = 16\[/plugin\]. This matches with the points in our column: (1, 2), (2, 4), (3, 16).

Since our function has some points, we can actually plot it on a graph!

\[plugin:graph\]Plot the quadratic function f(x) = 5x² - 13x + 10 as a smooth blue curve (#4a9eff).
Verify: f(1)=5-13+10=2, f(2)=20-26+10=4, f(3)=45-39+10=16. The curve MUST pass through these exact points.
Data points at (1, 2), (2, 4), and (3, 16) as red circles (#ef4444), radius 5.
X-axis range: 0 to 4. Y-axis range: -2 to 18.
Title: "f(x) = 5x² − 13x + 10". Label axes "x" and "y".
Legend: use short labels "f(x)" and "Data" (not the full equation). Keep legend compact, well inside chart bounds.\[/plugin\]

For our use case, when we pick what kind of function we want to plot through our points, we use a quadratic equation. You might have flinched there. If I can resuscitate the 14 year old out of your cerebellum, I'll remind you that the quadratic equation is just a second-degree polynomial. In other words:

\[plugin:math\]\[f(x) = ax^2 + bx + c\]\[/plugin\]

The reason why we like to use a quadratic equation to describe our function, is because our column has 3 points. As it turns out, there is 1 unique polynomial with degree \[plugin:math\]d\[/plugin\] that passes through \[plugin:math\]d+1\[/plugin\] points. In other words, there is one unique quadratic equation (our function \[plugin:math\]f\[/plugin\]) that can be used to represent our data points (1, 2), (2, 4), (3, 16). If that doesn't yet make sense, no worries, let's use a simpler example and move up from there.

We can express this concept with simpler functions than the quadratic equation: namely, polynomials of highest-degree 1. These are also just called lines: \[plugin:math\]f(x) = mx + b\[/plugin\]. An example of a line is \[plugin:math\]f(x) = x + 1\[/plugin\]. I'm not overloading that term "line" with something more complicated, I'm literally just talking about lines. A line is a degree-1 polynomial, because it could also be written as \[plugin:math\]f(x) = x^1 + 1\[/plugin\]. Here's our line plotted on a graph:

\[plugin:graph\]Plot EXACTLY ONE line: f(x) = x + 1, as a solid blue line (#4a9eff), thickness 2.5. Do NOT draw any other lines.
Data points at (0, 1) and (1, 2) as red circles (#ef4444), radius 5.
X-axis range: -2 to 3. Y-axis range: -1 to 5.
Title: "f(x) = x + 1".
Legend: "f(x)" and "Points". Keep legend compact.\[/plugin\]

Okay, now we can explain everything we need to with lines. The main thing we need to understand is that in order to know which line we are drawing, we need two points. If we just have one point, we could draw infinitely many lines through that point. See this plot below to understand that:

\[plugin:graph\]Show how infinite lines can pass through a single point.
Draw 6 ghost lines (dashed, very faint white at 15% opacity) through point (0, 1) with slopes: -2, -1, 0, 0.5, 2, 3.
Highlight one solid blue line (#4a9eff) f(x) = x + 1 with thickness 2.5.
One red data point (#ef4444) at (0, 1), labeled "(0, 1)".
X-axis range: -2 to 3. Y-axis range: -2 to 5.
Title: "Infinite Lines Through One Point".
Include a legend for the highlighted line and the point.\[/plugin\]

As you can see, just writing down the point (0, 1) isn't enough to know that we are dealing with the line \[plugin:math\]f(x) = x + 1\[/plugin\]. In fact, it reveals nothing to us. We don't have a clue which line we are supposed to draw! Once we add a second point, though, we go from infinitely many lines to only 1 single possible line. See below:

\[plugin:graph\]Show how two points define a unique line.
Draw 6 ghost lines (dashed, extremely faint white at 8% opacity) through point (0, 1) with slopes: -2, -1, 0, 0.5, 2, 3.
Highlight one solid blue line (#4a9eff) f(x) = x + 1 with thickness 2.5.
Two red data points (#ef4444) at (0, 1) and (1, 2), labeled "Two Points".
X-axis range: -2 to 3. Y-axis range: -1 to 5.
Title: "Two Points Define a Unique Line".
Include a legend for the highlighted line and the points.\[/plugin\]

As the visual shows, 2 points is enough to represent a single unique line. This rule scales to all degrees of polynomials: for degree 2 functions, or quadratic equations, 3 points is enough to represent a unique quadratic equation, and for degree 3 functions, 4 points is enough, and so on… In our case, our table's column has 3 points, so we can represent it with a unique quadratic equation (i.e. a degree-2 polynomial):

Values Column = (1, 2), (2, 4), (3, 16)

\[plugin:math\]\[f(x) = 5x^2 - 13x + 10\]\[/plugin\]

Verification:

\[plugin:math\]\[f(1) = 5 \\cdot 1^2 - 13 \\cdot 1 + 10 = 2\]\[/plugin\]

\[plugin:math\]\[f(2) = 5 \\cdot 2^2 - 13 \\cdot 2 + 10 = 4\]\[/plugin\]

\[plugin:math\]\[f(3) = 5 \\cdot 3^2 - 13 \\cdot 3 + 10 = 16\]\[/plugin\]

These evaluations line up perfectly with our original table. You might be asking, how did you get that equation from our points? Good question! The answer is that I asked AI:

"Give me the unique quadratic equation that fits points (1, 2), (2, 4), (3, 16)."

Easy! Seriously, though, there are a couple of methods by which you can do this by hand:


1. **Polynomial interpolation.** This is the way the zk pros actually create their unique polynomials from their data points. It is a mathematical technique that allows you to turn any set of \[plugin:math\]n\[/plugin\] points into a unique \[plugin:math\]n-1\[/plugin\] degree polynomial.
2. **Create a system of equations.** This is another basic math concept that you may have learned long ago. Effectively, you turn your points into equations, and solve for your coefficients, i.e.:

    \[plugin:math\]\[a(1)^2 + b(1) + c = 2\]\[/plugin\]

    \[plugin:math\]\[a(2)^2 + b(2) + c = 4\]\[/plugin\]

    \[plugin:math\]\[a(3)^2 + b(3) + c = 16\]\[/plugin\]

At any rate, you don't need to know exactly how to construct these functions from the data points, but you should come out of this section with the understanding that once we have a table that represents the execution trace from our program, each column in that table can be converted to points, and all of the points in a column can then converted to a single unique function using polynomial interpolation.

### Step 3. Establish and Prove our Constraints

Now that we have a function \[plugin:math\]f(x)\[/plugin\] that uniquely fits our original points (1, 2), (2, 4), (3, 16), and therefore uniquely represents our original execution trace, we can get to the meat of our zk proving system.

Here's the main part: the way by which we prove that our computation is valid (i.e., the 4th root of 16 = 2), is by convincing someone that our unique \[plugin:math\]f(x)\[/plugin\] function satisfies certain properties. We do this by using points on our polynomial other than our original data. The result is that the person we are proving to is convinced that the original data points are valid, and represent a valid execution trace, without ever being shown the original data points! Very zero-knowledge, indeed.

Our dataset, and consequently \[plugin:math\]f(x)\[/plugin\], has two important properties:


1. For the rows in our original table, the value in a row is equal to the square of the value in the previous row. For example, \[plugin:math\]f(2) = 4 = 2 \\times 2 = f(1) \\times f(1)\[/plugin\].
2. The value of the third row is 16 (our output). In other words, \[plugin:math\]f(3) = 16\[/plugin\].

We express these as **constraints** — equations that must hold at specific points on our function:

\[plugin:math\]\[f(x+1) - f(x) \\cdot f(x) = c(x)\]\[/plugin\]

\[plugin:math\]\[f(x) - 16 = d(x)\]\[/plugin\]

The first is called a **"transition constraint"** — it represents the relationship between consecutive rows, specifically that \[plugin:math\]f(x+1)\[/plugin\] equals the square of \[plugin:math\]f(x)\[/plugin\]. The second is a **"boundary constraint"** — it asserts the output of our program, that \[plugin:math\]f(3) = 16\[/plugin\].

If we can convince someone that these constraints hold, they can follow these logical steps:


1. I am convinced that this person knows a unique degree-2 polynomial function \[plugin:math\]f(x)\[/plugin\], where for \[plugin:math\]x = 1\[/plugin\] and \[plugin:math\]x = 2\[/plugin\], \[plugin:math\]f(x+1) = f(x) \\cdot f(x)\[/plugin\], and also where for \[plugin:math\]x = 3\[/plugin\], \[plugin:math\]f(3) = 16\[/plugin\].
2. Because I am convinced that for \[plugin:math\]x = 1\[/plugin\] and \[plugin:math\]x = 2\[/plugin\], \[plugin:math\]f(x+1) = f(x) \\cdot f(x)\[/plugin\], I am convinced that \[plugin:math\]f(3) = f(2) \\cdot f(2) = f(1) \\cdot f(1) \\cdot f(1) \\cdot f(1) = f(1)^4\[/plugin\]. Therefore, I am convinced that \[plugin:math\]f(1)\[/plugin\] is the 4th root of \[plugin:math\]f(3)\[/plugin\].
3. Because I am convinced that for \[plugin:math\]x = 3\[/plugin\], \[plugin:math\]f(3) = 16\[/plugin\], I am convinced that \[plugin:math\]f(1)\[/plugin\] is the 4th root of 16.
4. Because I am convinced that the prover knows what the polynomial function \[plugin:math\]f\[/plugin\] is, I am convinced that they can use this function to compute any of its points, including \[plugin:math\]f(1)\[/plugin\], and therefore they know \[plugin:math\]f(1)\[/plugin\].
5. Since I am convinced this person knows \[plugin:math\]f(1)\[/plugin\], I am convinced this person knows the fourth root of \[plugin:math\]f(3) = 16\[/plugin\].

This logical deduction does not require the verifier to ever see the value of \[plugin:math\]f(1)\[/plugin\] or \[plugin:math\]f(2)\[/plugin\]. They just need to be convinced that these constraints hold.

> **What does a zk proof actually look like?** The proof is just a handful of numbers — evaluations of polynomials at a single random point \[plugin:math\]z\[/plugin\]. The verifier never sees the original data points, never learns \[plugin:math\]f(1)\[/plugin\] or \[plugin:math\]f(2)\[/plugin\], and never touches the execution trace. They just check a few arithmetic relationships between the numbers they receive, and that's enough.

So how do we actually convince them? This is the hardest part, even if it is all still middle school math, so bear with me.

#### Convincing them that f(x+1) = f(x) \* f(x)

We'll work on the transition constraint first. Within our original data points, we can see that \[plugin:math\]f(x+1) = f(x) \\cdot f(x)\[/plugin\]. For example, \[plugin:math\]f(2) = 4 = 2 \\times 2 = f(1) \\cdot f(1)\[/plugin\], and \[plugin:math\]f(3) = 16 = 4 \\times 4 = f(2) \\cdot f(2)\[/plugin\]. Restating this, we can say that \[plugin:math\]f(x+1) - f(x) \\cdot f(x)\[/plugin\] is zero when \[plugin:math\]x = 1\[/plugin\] and \[plugin:math\]x = 2\[/plugin\].

Well, this pattern holds for a couple of our points, but it doesn't hold for every point. If we calculated \[plugin:math\]f(4)\[/plugin\] on our function \[plugin:math\]f(x)\[/plugin\], it wouldn't equal \[plugin:math\]f(3)^2\[/plugin\] (you can verify this yourself with \[plugin:math\]f(x)\[/plugin\], if you'd like). So how can we use that statement to prove something about every point on our function, not just those two? The answer is this: if we define a new function \[plugin:math\]c(x)\[/plugin\], and say that \[plugin:math\]c(x) = f(x+1) - f(x) \\cdot f(x)\[/plugin\], we can say that \[plugin:math\]c(1) = 0\[/plugin\], and \[plugin:math\]c(2) = 0\[/plugin\]. This should make sense, since we know that when \[plugin:math\]x = 1\[/plugin\], \[plugin:math\]c(1) = f(2) - f(1) \\cdot f(1) = 4 - 2 \\times 2 = 0\[/plugin\], and when \[plugin:math\]x = 2\[/plugin\], \[plugin:math\]c(2) = f(3) - f(2) \\cdot f(2) = 16 - 4 \\times 4 = 0\[/plugin\]. And if we know that \[plugin:math\]c(1) = 0\[/plugin\] and \[plugin:math\]c(2) = 0\[/plugin\], then we can say that 1 & 2 are **zeroes** of \[plugin:math\]c(x)\[/plugin\].

What does it mean when a polynomial has zeroes? Once again, this should be dormant knowledge that we can extract from your brain. To do so, we can remind ourselves of a simple example. Let's take the quadratic equation:

\[plugin:math\]\[e(x) = x^2 - 5x + 6\]\[/plugin\]

If we factor this polynomial, we get \[plugin:math\]e(x) = (x - 3)(x - 2)\[/plugin\] as the factors of our polynomial. You can probably verify this yourself, or ask AI for a refresher. If \[plugin:math\](x - 3)\[/plugin\] is a factor of the polynomial, that means that 3 is a zero for that polynomial, and the same goes for \[plugin:math\](x - 2).\[/plugin\] Let's try it out:

\[plugin:math\]\[e(3) = 3^2 - 5 \\cdot 3 + 6 = 9 - 15 + 6 = 0\]\[/plugin\]

Ok, now let's steer things back to our \[plugin:math\]c(x)\[/plugin\] function that we actually care about.

\[plugin:math\]c(x)\[/plugin\] is a more complicated equation than the ones we've seen so far. This is because it contains the product of two polynomials, namely the \[plugin:math\]f(x) \\cdot f(x)\[/plugin\] part within \[plugin:math\]c(x) = f(x+1) - f(x) \\cdot f(x)\[/plugin\]. If we tried to write out what \[plugin:math\]c(x)\[/plugin\] is by plugging in the quadratic equation form of \[plugin:math\]f(x)\[/plugin\], we would get:

\[plugin:math\]\[c(x) = (5(x+1)^2 - 13(x+1) + 10) - (5x^2 - 13x + 10)^2\]\[/plugin\]

And the evaluation of that expression ends up being:

\[plugin:math\]\[c(x) = -25x^4 + 130x^3 - 264x^2 + 257x - 98\]\[/plugin\]

That polynomial is too complicated for my liking, and I don't want you to have to think about something like that either. We just need to understand a very simple thing about \[plugin:math\]c(x)\[/plugin\]:

\[plugin:math\]\[c(1) = 0\]\[/plugin\]

\[plugin:math\]\[c(2) = 0\]\[/plugin\]

It's true! You're free to verify this yourself by plugging in 1 & 2 as x-values to the fully-written form of \[plugin:math\]c(x)\[/plugin\]. Remember that even though \[plugin:math\]c(x)\[/plugin\] looks ugly and complicated in its fully written-out form, it really is still just \[plugin:math\]c(x) = f(x+1) - f(x) \\cdot f(x)\[/plugin\], which we know is zero for our \[plugin:math\]x = 1\[/plugin\] and \[plugin:math\]x = 2\[/plugin\]. Now, since we know that \[plugin:math\]c(1) = 0\[/plugin\] and \[plugin:math\]c(2) = 0\[/plugin\], we know that \[plugin:math\](x - 1)\[/plugin\] and \[plugin:math\](x - 2)\[/plugin\] are both factors of \[plugin:math\]c(x)\[/plugin\]. So, we could re-write \[plugin:math\]c(x)\[/plugin\] in a more simple form:

\[plugin:math\]\[c(x) = (x - 1)(x - 2) \\cdots\]\[/plugin\]

Where the … represents the rest of the factors of \[plugin:math\]c(x)\[/plugin\]. We don't care about those other factors, so let's just use a polynomial to represent them, called \[plugin:math\]h(x)\[/plugin\].

\[plugin:math\]\[c(x) = (x - 1)(x - 2) \\cdot h(x)\]\[/plugin\]

\[plugin:math\]h(x)\[/plugin\] just represents all the factors in \[plugin:math\]c(x)\[/plugin\] besides \[plugin:math\](x - 1)\[/plugin\] and \[plugin:math\](x - 2)\[/plugin\] multiplied together. In modern zk proving systems, \[plugin:math\]h(x)\[/plugin\] is called the **quotient polynomial**.

At this point we have our original \[plugin:math\]f(x)\[/plugin\] function, plus a \[plugin:math\]c(x)\[/plugin\] function that represents \[plugin:math\]c(x) = f(x+1) - f(x) \\cdot f(x)\[/plugin\], and finally a new \[plugin:math\]h(x)\[/plugin\] function that represents all the factors of \[plugin:math\]c(x)\[/plugin\] besides \[plugin:math\](x - 1)\[/plugin\] and \[plugin:math\](x - 2)\[/plugin\]. Using these three things, we can actually prove what we need to prove! And here's how:


1. Our verifier picks a random large \[plugin:math\]x\[/plugin\] value, we'll call it \[plugin:math\]z\[/plugin\], that isn't from any of our known x values \[plugin:math\]x = 1\[/plugin\], \[plugin:math\]x = 2\[/plugin\], or \[plugin:math\]x = 3\[/plugin\]. As we mentioned earlier in the guide, this is the part where we use points outside of our original dataset.
2. The prover calculates \[plugin:math\]f(z)\[/plugin\], \[plugin:math\]f(z+1)\[/plugin\], \[plugin:math\]c(z)\[/plugin\] and \[plugin:math\]h(z)\[/plugin\] and gives those evaluations to the verifier. 
3. The verifier validates that \[plugin:math\]c(z) = f(z+1) - f(z) \\cdot f(z)\[/plugin\].
4. The verifier validates that \[plugin:math\]h(z) \\cdot (z - 1)(z - 2) = c(z)\[/plugin\].
5. The verifier is convinced that \[plugin:math\]f(x + 1) = f(x) \\cdot f(x)\[/plugin\] for \[plugin:math\]x = 1, 2\[/plugin\].

Wait, what? How? Why would checking a single random point be convincing at all?

In order to answer this question, we have to use something called the **Schwartz-Zippel lemma**[plugin:cite]Schwartz, "Fast Probabilistic Algorithms for Verification of Polynomial Identities", 1980, https://doi.org/10.1145/322217.322225[/plugin][plugin:cite]Zippel, "Probabilistic Algorithms for Sparse Polynomials", 1979, https://doi.org/10.1007/3-540-09519-5_73[/plugin]. This may sound scary, but the result of this lemma that we care about is very simple: if two polynomials \[plugin:math\]a(x)\[/plugin\] and \[plugin:math\]b(x)\[/plugin\] are not equal to each other, then for a large enough random \[plugin:math\]z\[/plugin\] the probability that \[plugin:math\]a(z) = b(z)\[/plugin\] is extremely small.

What does that mean for us? It means that if the prover used their polynomials \[plugin:math\]c\[/plugin\] and \[plugin:math\]f\[/plugin\] to calculate \[plugin:math\]c(z) = f(z+1) - f(z) \cdot f(z)\[/plugin\], and if \[plugin:math\]c(x)\[/plugin\] and \[plugin:math\]f(x+1) - f(x) \cdot f(x)\[/plugin\] were not actually equal polynomials, then due to the Schwartz-Zippel lemma the probability that the equation holds at random \[plugin:math\]z\[/plugin\] is extremely small. Conversely, the opposite holds: if \[plugin:math\]c(z) = f(z+1) - f(z) \cdot f(z)\[/plugin\] does check out at a random \[plugin:math\]z\[/plugin\], then it is overwhelmingly likely that \[plugin:math\]c(x) = f(x+1) - f(x) \cdot f(x)\[/plugin\] everywhere. The same logic applies to every equation the verifier checks. This is why we say that the verifier is "convinced," because they understand that the probability of the prover being able to cheat is extremely small.

Now, we can use that fact to re-examine those evaluations at z:

Step 3 convinces the verifier that \[plugin:math\]c(x) = f(x+1) - f(x) \\cdot f(x)\[/plugin\], due to the Schwartz-Zippel Lemma. However, it doesn't tell us anything useful about \[plugin:math\]f(x)\[/plugin\] yet.

**For Step 4:** Now that we've validated that \[plugin:math\]c(z) = f(z+1) - f(z) \\cdot f(z)\[/plugin\], we then validate that \[plugin:math\]c(z) = h(z) \\cdot (z - 1)(z - 2)\[/plugin\]. Why do we do this? Remember that if a polynomial contains a factor like \[plugin:math\](x - 1)\[/plugin\], it evaluates to zero at \[plugin:math\]x = 1\[/plugin\]. So by saying that \[plugin:math\]c(z) = h(z) \\cdot (z - 1)(z - 2)\[/plugin\], we are saying that \[plugin:math\]c(x)\[/plugin\] has factors \[plugin:math\](x - 1)\[/plugin\] and \[plugin:math\](x - 2).\[/plugin\] Further, by saying that \[plugin:math\]c(x)\[/plugin\] has factors \[plugin:math\](x - 1)\[/plugin\] and \[plugin:math\](x - 2)\[/plugin\], we are saying that \[plugin:math\]c(x) = 0\[/plugin\] for \[plugin:math\]x = 1\[/plugin\] and \[plugin:math\]c(x) = 0\[/plugin\] for \[plugin:math\]x = 2\[/plugin\].

**For Step 5:** finally, put these two steps together! We have shown that \[plugin:math\]c(x) = f(x+1) - f(x) \\cdot f(x)\[/plugin\], and we have shown that \[plugin:math\]c(x) = 0\[/plugin\] for \[plugin:math\]x = 1\[/plugin\] and \[plugin:math\]x = 2\[/plugin\]. The corollary of this is that \[plugin:math\]f(x+1) - f(x) \\cdot f(x) = 0\[/plugin\], for \[plugin:math\]x = 1\[/plugin\] and \[plugin:math\]x = 2\[/plugin\]. In other words, we have convinced the verifier that \[plugin:math\]f(2) = f(1) \\cdot f(1)\[/plugin\], and \[plugin:math\]f(3) = f(2) \\cdot f(2)\[/plugin\], which was the first property that we were trying to prove about \[plugin:math\]f\[/plugin\]!!

And there we have it. We've used a random point \[plugin:math\]z\[/plugin\], evaluations of \[plugin:math\]f(z)\[/plugin\], \[plugin:math\]c(z)\[/plugin\], and \[plugin:math\]h(z)\[/plugin\], and the values \[plugin:math\](z - 1)\[/plugin\] and \[plugin:math\](z - 2)\[/plugin\] to prove that \[plugin:math\]f(x+1) = f(x) \\cdot f(x)\[/plugin\] for \[plugin:math\]x = 1\[/plugin\] & \[plugin:math\]x = 2\[/plugin\], without having ever revealed \[plugin:math\]f(1)\[/plugin\] or \[plugin:math\]f(2)\[/plugin\]. If you've understood this part, you've understood the most important bit of modern zk proving systems.

#### Convincing the verifier that f(3) = 16

The same idea applies here, but simpler. We define \[plugin:math\]d(x) = f(x) - 16\[/plugin\]. Since \[plugin:math\]f(3) = 16\[/plugin\], we know \[plugin:math\]d(3) = 0\[/plugin\], which means \[plugin:math\](x - 3)\[/plugin\] is a factor of \[plugin:math\]d(x)\[/plugin\]. So we can write:

\[plugin:math\]\[d(x) = (x - 3) \\cdot g(x)\]\[/plugin\]

Where \[plugin:math\]g(x)\[/plugin\] is another quotient polynomial. Using the same random \[plugin:math\]z\[/plugin\], the verifier checks:


1. That \[plugin:math\]d(z) = f(z) - 16\[/plugin\] (confirming the definition of \[plugin:math\]d\[/plugin\]).
2. That \[plugin:math\]g(z) \\cdot (z - 3) = d(z)\[/plugin\] (confirming that \[plugin:math\](x - 3)\[/plugin\] is a factor, and therefore \[plugin:math\]d(3) = 0\[/plugin\]).

Since \[plugin:math\]d(x) = f(x) - 16\[/plugin\] and \[plugin:math\]d(3) = 0\[/plugin\], it follows that \[plugin:math\]f(3) = 16\[/plugin\]. That's our boundary constraint, proven!

Now that we have convinced our verifier of both constraints, they can follow the logical deduction we outlined earlier to conclude that the prover knows the fourth root of 16 — without ever seeing \[plugin:math\]f(1)\[/plugin\] or \[plugin:math\]f(2)\[/plugin\].

At this point, we have gone through the entire proving and verifying flow. Our prover has converted their execution trace of the computation \[plugin:math\]2^4 = 16\[/plugin\], generated a proof (the proof is all the requested evaluations for \[plugin:math\]z\[/plugin\]: \[plugin:math\]f(z), f(z+1), c(z), d(z), h(z), g(z), (z-1), (z-2), (z-3)\[/plugin\]), and had that proof verified to convince someone that they know the 4th root of 16.

In the real proving systems, we aren't just proving a couple of tiny constraints like this. We would be proving thousands, or millions, (or billions) of constraints. And all those constraints would add up to convince a verifier that we ran a complicated program on some secret inputs and produced some public outputs that we claim are valid. In Zippy, all we did was prove we knew the 4th root of 16. But the system we used to do this scales from that teeny tiny little use case to much more complicated secret inputs and public outputs, like:

* I can prove that when I run my ID (the secret input) through a machine learning program, it will detect that my age is 18 or above (the output).
* I can prove that my bank account statement (secret input) contains a valid balance (the output) to take out a loan.
* I can prove that my vote for the newest government elections (secret input), is a valid, unique vote (output), and in doing so I complete my civic duty in an incorruptible, anonymous way.

This simple system that we defined here can be scaled to handle some of the most important and interesting problems in privacy and governance, and if you understand this system, you now understand one of the best solutions to these problems.

### Epilogue: Commitment Schemes, and Where to Go from Here

There is one final unresolved issue with our system: our \[plugin:math\]f(x)\[/plugin\] function was supposed to be a degree-2 polynomial, because there is only one unique degree-2 polynomial that satisfies our constraints: \[plugin:math\]f(x) = 5x^2 - 13x + 10\[/plugin\].

But what if our prover tried using a degree-3 polynomial? It turns out there are infinitely many degree-3 polynomials that can falsely satisfy our constraints. A couple valid examples:

\[plugin:math\]\[f(x) = x^3 - 2x^2 - 2x + 4\]\[/plugin\]

\[plugin:math\]\[f(x) = x^3 - 3x^2 - 8x + 8\]\[/plugin\]

It's just like that analogy we had with drawing infinitely many lines through a single point. Once we add an extra degree to our function, we can no longer uniquely identify a polynomial with our current constraints.

To address this problem, the solution used by all popular proving systems is a **polynomial commitment scheme** — a mathematical technique that ensures the points the prover hands over really come from a polynomial of the expected degree. You can think of it like a secret box: the prover locks their polynomial inside, and the box only accepts polynomials of the right degree. When the verifier asks for a point, they pull it out of the box, and therefore know it came from a valid polynomial.

The actual commitment schemes — FRI[plugin:cite]Ben-Sasson, Bentov, Horesh, Riabzev, "Fast Reed-Solomon Interactive Oracle Proofs of Proximity", 2017, https://eccc.weizmann.ac.il/report/2017/134[/plugin] (used in STARKs) and KZG[plugin:cite]Kate, Zaverucha, Goldberg, "Constant-Size Commitments to Polynomials and Their Applications", 2010, https://www.iacr.org/archive/asiacrypt2010/6477178/6477178.pdf[/plugin] (used in many SNARKs) — are mathematically involved and well beyond middle school math. Understanding how they work is a great next step once you're comfortable with everything covered here.

**All done!**

[block]
Now that you've gotten through this, you can deepen your knowledge on each key concept:

* Execution traces[plugin:cite]RISC Zero, "What is a Trace?", 2024, https://dev.risczero.com/proof-system/what-is-a-trace[/plugin]
* Arithmetization[plugin:cite]RareSkills, "Rank-1 Constraint System", 2024, https://rareskills.io/post/rank-1-constraint-system[/plugin][plugin:cite]Zcash, "Arithmetization (Halo 2)", 2023, https://zcash.github.io/halo2/concepts/arithmetization.html[/plugin][plugin:cite]Three Sigma, "Arithmetization in STARKs: Algebraic Intermediate Representation", 2023, https://threesigma.xyz/blog/zk/arithmetization-starks-algebraic-intermediate-representation[/plugin]
* Polynomial interpolation & the Schwartz-Zippel Lemma[plugin:cite]Wikipedia, "Lagrange polynomial", 2024, https://en.wikipedia.org/wiki/Lagrange_polynomial[/plugin][plugin:cite]Wikipedia, "Schwartz-Zippel lemma", 2024, https://en.wikipedia.org/wiki/Schwartz%E2%80%93Zippel_lemma[/plugin]
* Reed-Solomon Encoding[plugin:cite]Reed, Solomon, "Polynomial Codes over Certain Finite Fields", 1960, https://doi.org/10.1137/0108018[/plugin]
* Constraints[plugin:cite]Gennaro, Gentry, Parno, Raykova, "Quadratic Span Programs and Succinct NIZKs without PCPs", 2012, https://eprint.iacr.org/2012/215[/plugin]
* Polynomial Commitment Schemes
  * FRI[plugin:cite]Aszepieniec, "Anatomy of a STARK: FRI", 2021, https://aszepieniec.github.io/stark-anatomy/fri.html[/plugin][plugin:cite]Ankita, "Understanding FRI Polynomial Commitments Scheme", 2023, https://medium.com/@aannkkiittaa/understanding-fri-polynomial-commitments-scheme-7391da74c9d9[/plugin]
  * KZG[plugin:cite]Feist, "Kate polynomial commitments", 2020, https://dankradfeist.de/ethereum/2020/06/16/kate-polynomial-commitments.html[/plugin]
* End-to-end proving systems:
  * Groth16[plugin:cite]RareSkills, "Groth16", 2024, https://rareskills.io/post/groth16[/plugin]
  * PLONK[plugin:cite]Buterin, "Understanding PLONK", 2019, https://vitalik.eth.limo/general/2019/09/22/plonk.html[/plugin]
  * STARK[plugin:cite]Wong, "How STARKs work if you don't care about FRI", 2024, https://cryptologie.net/posts/how-starks-work-if-you-dont-care-about-fri/[/plugin]
[/block]


