const express = require('express')
const bodyParser = require('body-parser')
const Tasks = require('./taskModel')
const mongoose = require('mongoose')

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

// mongoose connect
if (!process.env.MONGODB_URI) {
	console.error("No MongoDB URI given. Please supply one as an environment variable MONGODB_URI.")
}
mongoose.connect(process.env.MONGODB_URI)

app.get('/', async function(req, res) {
  // get a list of all tasks
  try {
    const tasks = await Tasks.find().
      sort('-created_at').
      select('task_id created_at completed_at status params')

    renderTaskGrid(res, tasks)
  } catch (e) {
    renderError(res, e)
  }
})

app.get('/:taskid', async function (req, res) {
  try {
    const task = await Tasks.findById(req.params.taskid)
    renderTaskInfo(res, task)
  } catch (e) {
    renderError(res, e)
  }
})

app.post('*', function(req, res) {
  if (process.env.SCALE_CALLBACK_AUTH_KEY) {
    // Verify the callback auth key is correct
    if (req.headers['scale-callback-auth'] !== process.env.SCALE_CALLBACK_AUTH_KEY) {
      return res.status(500).send("Callback auth key is incorrect. Invalid callback")
    }
  }

  // Send 200 response code immediately
  res.status(200).send("Success!")

  // Update task in db idempotently
  const task_id = req.body.task_id

  Tasks.findOneAndUpdate(
    { task_id: task_id },
    req.body.task,
    { upsert: true, new: true },
    function(err, task) {
      if (err) {
        console.error("Error updating document: " + err)
      } else {
        console.log(`Task (task_id: ${task_id}) successfully updated!`)
      }
    })
})


const port = process.env.PORT || 3000
app.listen(port, function() {
  console.log('Express server running on localhost:%d', port)
})

function renderTaskGrid(res, tasks) {
  res.status(200).send(`
    <html>
      <body>
        <table>
          <thead>
            <tr>
              <th>task id</th>
              <th>created at</th>
              <th>completed at</th>
              <th>status</th>
              <th>actions</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(renderTaskRow)}
          </tbody>
        </table>
      </body>
    </html>
  `)
}

function renderTaskRow(task) {
  return `
    <tr>
      <td>${task.task_id}</td>
      <td>${task.created_at}</td>
      <td>${task.completed_at}</td>
      <td>${task.status}</td>
      <td><a href='/${task.task_id}'>View Details</a></td>
    </tr>
  `
}

function renderTaskInfo(res, task) {
  res.status(200).send(`
    <html>
      <body>
        <table>
          <tbody>
            <tr>
              ${renderTaskInfoField(task, 'id', 'task_id')}
              ${renderTaskInfoField(task, 'created', 'created_at')}
              ${renderTaskInfoField(task, 'completed', 'completed_at')}
              ${renderTaskInfoField(task, 'status', 'status')}
              <th><strong>image</strong></th><td><img src='${task.params.attachment}' width='640' height='480' /></td>
              ${renderTaskInfoField(task, 'image', 'status')}
              <th><strong>response</strong></th><td><pre>${JSON.stringify(task.response, null, 2)}</pre></td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `)
}

function renderTaskInfoField(task, label, prop) {
  return `
    <th><strong>${label}</strong></th><td>${task[prop]}</td>
  `
}

function renderError(res, err) {
  console.error(err)

  res.status(500).send(`
    <html>
      <body>
        <h1>${err.name}</h1>
        <p>${err.message}</p>
        <pre>
          ${err.stack && err.stack.join('\n')}
        </pre>
      </body>
    </html>
  `)
}
