console.log('Extension Hub loaded - the pages page works')
import MozChat from './features/chat/MozChat'

customElements.define('moz-chat', MozChat)

function addContent() {
  const div = document.createElement('div')
  div.className = 'dynamic'
  div.innerHTML = `<p>New content added at ${new Date().toLocaleTimeString()}</p>`
  const content = document.getElementById('content')
  if (!content) {
    console.error('Content element not found!')
    return
  }
  content.appendChild(div)
}

function clearContent() {
  const content = document.getElementById('content')
  if (!content) {
    console.error('Content element not found!')
    return
  }
  content.innerHTML = ''
}

document.addEventListener('DOMContentLoaded', function () {
  console.log('Template loaded successfully!')
  const addBtn = document.getElementById('add-btn')
  const clearBtn = document.getElementById('clear-btn')
  if (!addBtn || !clearBtn) {
    console.error('Buttons not found!')
    return
  }

  // Add event listeners properly
  addBtn.addEventListener('click', addContent)
  clearBtn.addEventListener('click', clearContent)

  // You can also add other event listeners
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.ctrlKey) {
      addContent()
    }
  })
})
